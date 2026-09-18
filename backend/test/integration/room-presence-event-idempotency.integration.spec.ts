import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { LocationVerificationService } from '../../src/modules/location-verification/location-verification.service';
import { RoomPresenceService } from '../../src/modules/room-presence/room-presence.service';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// RULE-PRES-04/07/08 (attendance-presence-flow-rules.md) — room_presence_event's
// own idempotency guarantee (AddRoomPresenceEvent migration: UNIQUE
// (identification_checkin_id), consumed via INSERT ... ON CONFLICT DO NOTHING
// in RoomPresenceService.recordFromCheckin) is exactly the kind of thing that
// can only be trusted against a real unique constraint, not a mocked
// insert-or-ignore builder — the unit spec (room-presence.service.spec.ts)
// already covers the decision logic (which checkins produce a row, entry vs
// exit direction) with a mocked manager; this spec is the real-Postgres
// complement, verifying a redelivered DEDUPLICATE_CHECKIN_QUEUE job (the
// worker's own documented at-least-once concern, deduplication.worker.ts)
// never produces a second room_presence_event row for the same checkin.
describe('RoomPresenceService.recordFromCheckin idempotency (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenantContext: TenantContextService;
  let tenant: TenantFixture;
  let deviceId: string;
  let roomEntryFactorTypeId: string;
  let classSessionId: string;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'RoomPresenceIdem');

    const deviceResult = await superuser.query(
      `INSERT INTO device (tenant_id, device_type, external_identifier, api_key_id, api_key_secret_hash)
       VALUES ($1, 'raspberry_pi', 'room-presence-idem-test-device', $2, 'unused-hash')
       RETURNING id`,
      [tenant.tenantId, `room-presence-idem-test-key-${Date.now()}`],
    );
    deviceId = deviceResult.rows[0].id as string;

    const factorTypeResult = await superuser.query(
      `SELECT id FROM attendance_factor_type WHERE tenant_id IS NULL AND code = 'ROOM_ENTRY'`,
    );
    roomEntryFactorTypeId = factorTypeResult.rows[0].id as string;

    const courseResult = await superuser.query(`INSERT INTO course (tenant_id, name) VALUES ($1, 'Course') RETURNING id`, [
      tenant.tenantId,
    ]);
    const classGroupResult = await superuser.query(
      `INSERT INTO class_group (tenant_id, course_id, name) VALUES ($1, $2, 'Class Group') RETURNING id`,
      [tenant.tenantId, courseResult.rows[0].id],
    );
    const roomResult = await superuser.query(`INSERT INTO room (tenant_id, name) VALUES ($1, 'Room 1') RETURNING id`, [
      tenant.tenantId,
    ]);
    const classSessionResult = await superuser.query(
      `INSERT INTO class_session (
         tenant_id, class_group_id, room_id, scheduled_start, scheduled_end,
         min_attendance_percentage_snapshot, tolerance_minutes_snapshot, post_tolerance_behavior_snapshot
       ) VALUES ($1, $2, $3, now() - interval '1 hour', now() + interval '1 hour', 75, 15, 'accept_without_counting')
       RETURNING id`,
      [tenant.tenantId, classGroupResult.rows[0].id, roomResult.rows[0].id],
    );
    classSessionId = classSessionResult.rows[0].id as string;

    dataSource = createAppDataSource();
    await dataSource.initialize();
    tenantContext = new TenantContextService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await cleanupTenants(superuser, [tenant.tenantId]);
    await superuser.end();
  });

  async function insertRoomEntryCheckin(): Promise<string> {
    const capturedAt = new Date();
    const rawEventResult = await superuser.query(
      `INSERT INTO raw_identification_event (tenant_id, device_id, event_type, idempotency_key, raw_payload)
       VALUES ($1, $2, 'TAG_CHECKIN', $3, $4) RETURNING id`,
      [
        tenant.tenantId,
        deviceId,
        `idem-room-presence-${capturedAt.getTime()}-${Math.random()}`,
        JSON.stringify({ capturedAt: capturedAt.toISOString(), roomId: null, data: {} }),
      ],
    );
    const checkinResult = await superuser.query(
      `INSERT INTO identification_checkin (tenant_id, raw_identification_event_id, person_id, class_session_id, attendance_factor_type_id, checkin_at, is_duplicate)
       VALUES ($1, $2, $3, $4, $5, $6, false) RETURNING id`,
      [tenant.tenantId, rawEventResult.rows[0].id, tenant.personId, classSessionId, roomEntryFactorTypeId, capturedAt.toISOString()],
    );
    return checkinResult.rows[0].id as string;
  }

  test('test_recordFromCheckin_calledTwiceForSameCheckin_insertsOnlyOneRoomPresenceEventRow', async () => {
    const locationVerificationServiceStub = {} as LocationVerificationService;
    const service = new RoomPresenceService(tenantContext, locationVerificationServiceStub);
    const checkinId = await insertRoomEntryCheckin();

    await tenantContext.runWithTenant(tenant.tenantId, () => service.recordFromCheckin(checkinId));
    await tenantContext.runWithTenant(tenant.tenantId, () => service.recordFromCheckin(checkinId));

    const rows = await superuser.query('SELECT id, direction FROM room_presence_event WHERE identification_checkin_id = $1', [
      checkinId,
    ]);
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].direction).toBe('entry');
  });

  test('test_recordFromCheckin_twoDifferentCheckins_insertsTwoSeparateRows', async () => {
    const locationVerificationServiceStub = {} as LocationVerificationService;
    const service = new RoomPresenceService(tenantContext, locationVerificationServiceStub);
    const firstCheckinId = await insertRoomEntryCheckin();
    const secondCheckinId = await insertRoomEntryCheckin();

    await tenantContext.runWithTenant(tenant.tenantId, () => service.recordFromCheckin(firstCheckinId));
    await tenantContext.runWithTenant(tenant.tenantId, () => service.recordFromCheckin(secondCheckinId));

    const rows = await superuser.query('SELECT identification_checkin_id FROM room_presence_event WHERE identification_checkin_id = ANY($1::uuid[])', [
      [firstCheckinId, secondCheckinId],
    ]);
    expect(rows.rows).toHaveLength(2);
  });
});
