import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { DeduplicationService } from '../../src/modules/deduplication/deduplication.service';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// RULE-RET-03's window sizes only actually mean something once real
// Postgres `BETWEEN` timestamp arithmetic is involved — the unit spec
// (deduplication.service.spec.ts) verifies the service picks the right
// window size (2s vs 10s) per factor type, but "just inside" vs "just
// outside" the boundary is exactly the kind of thing that can only be
// trusted against a real database, not a mocked query() call.
describe('DeduplicationService window boundaries (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenantContext: TenantContextService;
  let tenant: TenantFixture;
  let deviceId: string;
  let tagCheckinFactorTypeId: string;
  let roomEntryFactorTypeId: string;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'DedupWindow');

    const deviceResult = await superuser.query(
      `INSERT INTO device (tenant_id, device_type, external_identifier, api_key_id, api_key_secret_hash)
       VALUES ($1, 'raspberry_pi', 'dedup-window-test-device', $2, 'unused-hash')
       RETURNING id`,
      [tenant.tenantId, `dedup-window-test-key-${Date.now()}`],
    );
    deviceId = deviceResult.rows[0].id as string;

    const factorTypes = await superuser.query(
      `SELECT id, code FROM attendance_factor_type WHERE tenant_id IS NULL AND code IN ('TAG_CHECKIN', 'ROOM_ENTRY')`,
    );
    tagCheckinFactorTypeId = factorTypes.rows.find((r) => r.code === 'TAG_CHECKIN').id;
    roomEntryFactorTypeId = factorTypes.rows.find((r) => r.code === 'ROOM_ENTRY').id;

    dataSource = createAppDataSource();
    await dataSource.initialize();
    tenantContext = new TenantContextService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await cleanupTenants(superuser, [tenant.tenantId]);
    await superuser.end();
  });

  // Inserts two identification_checkin rows (each backed by its own
  // raw_identification_event, matching the real FK) `secondsApart` seconds
  // apart, sharing the same person/session(null)/factor type, and returns
  // both ids so the test can call deduplicate() on the second and inspect it.
  async function insertTwoCheckinsSecondsApart(
    factorTypeId: string,
    secondsApart: number,
  ): Promise<{ firstId: string; secondId: string }> {
    const baseTime = new Date();
    const firstTime = new Date(baseTime.getTime());
    const secondTime = new Date(baseTime.getTime() + secondsApart * 1000);

    const ids: string[] = [];
    for (const checkinAt of [firstTime, secondTime]) {
      const rawEventResult = await superuser.query(
        `INSERT INTO raw_identification_event (tenant_id, device_id, event_type, idempotency_key, raw_payload)
         VALUES ($1, $2, 'TAG_CHECKIN', $3, $4) RETURNING id`,
        [
          tenant.tenantId,
          deviceId,
          `idem-window-${checkinAt.getTime()}-${Math.random()}`,
          JSON.stringify({ capturedAt: checkinAt.toISOString(), roomId: null, data: {} }),
        ],
      );
      const checkinResult = await superuser.query(
        `INSERT INTO identification_checkin (tenant_id, raw_identification_event_id, person_id, class_session_id, attendance_factor_type_id, checkin_at)
         VALUES ($1, $2, $3, NULL, $4, $5) RETURNING id`,
        [tenant.tenantId, rawEventResult.rows[0].id, tenant.personId, factorTypeId, checkinAt.toISOString()],
      );
      ids.push(checkinResult.rows[0].id);
    }
    return { firstId: ids[0], secondId: ids[1] };
  }

  async function isDuplicateFlagged(checkinId: string): Promise<{ isDuplicate: boolean; duplicateOfCheckinId: string | null }> {
    const result = await superuser.query('SELECT is_duplicate, duplicate_of_checkin_id FROM identification_checkin WHERE id = $1', [
      checkinId,
    ]);
    return { isDuplicate: result.rows[0].is_duplicate, duplicateOfCheckinId: result.rows[0].duplicate_of_checkin_id };
  }

  test('test_deduplicate_pointInTimeFactor_nineSecondsApart_marksSecondAsDuplicate', async () => {
    // Just inside the 10s point-in-time window.
    const { firstId, secondId } = await insertTwoCheckinsSecondsApart(tagCheckinFactorTypeId, 9);
    const service = new DeduplicationService(tenantContext);

    await tenantContext.runWithTenant(tenant.tenantId, () => service.deduplicate(secondId));

    const flagged = await isDuplicateFlagged(secondId);
    expect(flagged).toEqual({ isDuplicate: true, duplicateOfCheckinId: firstId });
  });

  test('test_deduplicate_pointInTimeFactor_elevenSecondsApart_leavesSecondAsCanonical', async () => {
    // Just outside the 10s point-in-time window.
    const { secondId } = await insertTwoCheckinsSecondsApart(tagCheckinFactorTypeId, 11);
    const service = new DeduplicationService(tenantContext);

    await tenantContext.runWithTenant(tenant.tenantId, () => service.deduplicate(secondId));

    const flagged = await isDuplicateFlagged(secondId);
    expect(flagged).toEqual({ isDuplicate: false, duplicateOfCheckinId: null });
  });

  test('test_deduplicate_stateTransitionFactor_pointNineSecondsApart_marksSecondAsDuplicate', async () => {
    // Just inside the 2s state-transition window (sensor double-fire).
    const { firstId, secondId } = await insertTwoCheckinsSecondsApart(roomEntryFactorTypeId, 1.9);
    const service = new DeduplicationService(tenantContext);

    await tenantContext.runWithTenant(tenant.tenantId, () => service.deduplicate(secondId));

    const flagged = await isDuplicateFlagged(secondId);
    expect(flagged).toEqual({ isDuplicate: true, duplicateOfCheckinId: firstId });
  });

  test('test_deduplicate_stateTransitionFactor_pointOneSecondsApart_leavesSecondAsCanonical', async () => {
    // Just outside the 2s state-transition window — RULE-ATT-08 requires this
    // NOT be collapsed, since it could be a genuine exit-and-return.
    const { secondId } = await insertTwoCheckinsSecondsApart(roomEntryFactorTypeId, 2.1);
    const service = new DeduplicationService(tenantContext);

    await tenantContext.runWithTenant(tenant.tenantId, () => service.deduplicate(secondId));

    const flagged = await isDuplicateFlagged(secondId);
    expect(flagged).toEqual({ isDuplicate: false, duplicateOfCheckinId: null });
  });
});
