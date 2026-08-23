import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { DataSource, EntityManager } from 'typeorm';
import { AreaAuthorizationService } from '../../src/modules/area-authorization/area-authorization.service';
import { IntrusionDetectionService } from '../../src/modules/intrusion-detection/intrusion-detection.service';
import { SecurityIngestionEventType } from '../../src/modules/security-ingestion/security-ingestion-event-type.enum';
import { WristbandIdentityService } from '../../src/modules/wristband-identity/wristband-identity.service';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// Minimal stand-in for TenantContextService, bound to ONE already-open
// transaction's EntityManager (a manually-managed QueryRunner, not
// dataSource.transaction()'s auto-commit-on-return). IntrusionDetectionService
// only ever calls getManager()/getTenantId() on whatever it's given
// (structural typing — the same substitution technique this codebase's unit
// specs already use for TenantContextService), so this is a faithful stand-in
// for the real thing. It exists purely so this test can hold a transaction
// open across an await boundary and control exactly when it commits, which
// TenantContextService.runWithTenant's single commit-on-return call cannot do.
interface StubTenantContext {
  getManager(): EntityManager;
  getTenantId(): string;
}

function stubTenantContext(manager: EntityManager, tenantId: string): StubTenantContext {
  return { getManager: () => manager, getTenantId: () => tenantId };
}

// CRITICAL fix regression test (code review finding #1 on
// IntrusionDetectionService.openNewIncident): processRawEvent runs inside
// ONE Postgres transaction (TenantContextService.runWithTenant — a single
// BEGIN...COMMIT, no savepoints of its own). Before the fix, a lost race on
// the speculative INSERT (23505 against intrusion_incident_one_open_per_tenant)
// marked that ENTIRE transaction aborted — every subsequent statement,
// including the fallback "find the winning open incident" lookup, then
// failed with 25P02 instead of succeeding, silently dropping the losing
// worker's raw_security_event (never correlated into
// intrusion_incident_location_entry, and pg-boss has no retry configured, so
// the job would be marked permanently failed).
//
// A mock-based spec (intrusion-detection.service.spec.ts) is structurally
// incapable of catching this class of bug — mocks don't reproduce Postgres's
// actual transaction-abort semantics. This test drives two REAL, genuinely
// concurrent Postgres transactions against the real dev database and asserts
// both signals end up correlated into the SAME incident, not one dropped.
//
// The exact race window is manufactured deterministically (T1's insert is
// left uncommitted on purpose, T2 is then started and given time to reach
// and block on its own conflicting INSERT, and only then is T1 committed)
// rather than left to Promise.all timing luck — this makes the test reliably
// exercise the exact failure path every run instead of only "most of the
// time", while every step is still real, unmocked Postgres behavior (real
// blocking on the unique index, a real 23505, a real SAVEPOINT rollback).
describe('IntrusionDetectionService concurrent open-incident race (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenant: TenantFixture;
  let areaId: string;
  let rawEventIdOne: string;
  let rawEventIdTwo: string;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'IntrusionRace');

    const areaResult = await superuser.query(`INSERT INTO area (tenant_id, name) VALUES ($1, 'Bloco Race Test') RETURNING id`, [
      tenant.tenantId,
    ]);
    areaId = areaResult.rows[0].id as string;

    const deviceResult = await superuser.query(
      `INSERT INTO device (tenant_id, device_type, external_identifier, api_key_id, api_key_secret_hash)
       VALUES ($1, 'ir_barrier', 'intrusion-race-test-device', $2, 'unused-hash')
       RETURNING id`,
      [tenant.tenantId, `intrusion-race-test-key-${Date.now()}`],
    );
    const deviceId = deviceResult.rows[0].id as string;

    // Two independent IR_BARRIER_CROSSING signals — both anonymous
    // candidates by RULE-SEC-01's note (a beam trip carries no identity),
    // both eligible to open the tenant's one allowed open incident.
    const capturedAt = new Date().toISOString();
    const eventOneResult = await superuser.query(
      `INSERT INTO raw_security_event (tenant_id, device_id, event_type, area_id, captured_at, idempotency_key, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        tenant.tenantId,
        deviceId,
        SecurityIngestionEventType.IR_BARRIER_CROSSING,
        areaId,
        capturedAt,
        `idem-race-1-${randomUUID()}`,
        JSON.stringify({}),
      ],
    );
    rawEventIdOne = eventOneResult.rows[0].id as string;

    const eventTwoResult = await superuser.query(
      `INSERT INTO raw_security_event (tenant_id, device_id, event_type, area_id, captured_at, idempotency_key, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        tenant.tenantId,
        deviceId,
        SecurityIngestionEventType.IR_BARRIER_CROSSING,
        areaId,
        capturedAt,
        `idem-race-2-${randomUUID()}`,
        JSON.stringify({}),
      ],
    );
    rawEventIdTwo = eventTwoResult.rows[0].id as string;

    dataSource = createAppDataSource();
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await cleanupTenants(superuser, [tenant.tenantId]);
    await superuser.end();
  });

  test('test_processRawEvent_twoConcurrentTransactionsRaceToOpenIncident_bothCorrelateIntoTheSameIncidentNeitherIsDropped', async () => {
    const queryRunnerA = dataSource.createQueryRunner();
    const queryRunnerB = dataSource.createQueryRunner();
    await queryRunnerA.connect();
    await queryRunnerB.connect();
    await queryRunnerA.startTransaction();
    await queryRunnerB.startTransaction();
    // Mirrors TenantContextService.runWithTenant's own SET LOCAL-equivalent
    // call exactly, so RLS applies for these manually-managed transactions
    // the same way it would for two real concurrent requests.
    await queryRunnerA.manager.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.tenantId]);
    await queryRunnerB.manager.query("SELECT set_config('app.tenant_id', $1, true)", [tenant.tenantId]);

    const contextA = stubTenantContext(queryRunnerA.manager, tenant.tenantId);
    const contextB = stubTenantContext(queryRunnerB.manager, tenant.tenantId);
    const serviceA = new IntrusionDetectionService(
      contextA as never,
      new WristbandIdentityService(contextA as never),
      new AreaAuthorizationService(contextA as never),
    );
    const serviceB = new IntrusionDetectionService(
      contextB as never,
      new WristbandIdentityService(contextB as never),
      new AreaAuthorizationService(contextB as never),
    );

    try {
      // T1 (serviceA) runs to completion — its speculative INSERT succeeds —
      // but its transaction is deliberately kept open/uncommitted below.
      await serviceA.processRawEvent(rawEventIdOne);

      // T2 (serviceB) starts concurrently with T1 still uncommitted. It
      // finds no open incident yet (T1's insert isn't visible/committed),
      // so it also attempts its OWN speculative INSERT — which conflicts
      // with T1's still-uncommitted row on the partial unique index.
      // Postgres blocks T2's INSERT until T1's transaction ends: the exact
      // real-world race window this bug lived in.
      const t2Promise = serviceB.processRawEvent(rawEventIdTwo);

      // Generous margin for T2's handful of async round trips (raw event
      // lookup, open-incident lookup, SAVEPOINT + INSERT) to actually reach
      // and block on that INSERT before T1 commits — local Postgres round
      // trips are sub-millisecond, so this is not a tight timing race.
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Unblocks T2's pending INSERT, which now genuinely fails with 23505
      // against T1's just-committed row — the exact scenario the fix's
      // SAVEPOINT must recover from without aborting T2's whole transaction.
      await queryRunnerA.commitTransaction();

      await t2Promise;
      await queryRunnerB.commitTransaction();
    } finally {
      await queryRunnerA.release();
      await queryRunnerB.release();
    }

    const incidents = await superuser.query('SELECT id, status FROM intrusion_incident WHERE tenant_id = $1', [tenant.tenantId]);
    expect(incidents.rows).toHaveLength(1);
    expect(incidents.rows[0].status).toBe('open');

    const locationEntries = await superuser.query(
      'SELECT raw_security_event_id, intrusion_incident_id FROM intrusion_incident_location_entry WHERE tenant_id = $1',
      [tenant.tenantId],
    );
    expect(locationEntries.rows).toHaveLength(2);
    const correlatedRawEventIds = locationEntries.rows.map((row: { raw_security_event_id: string }) => row.raw_security_event_id);
    expect(correlatedRawEventIds).toEqual(expect.arrayContaining([rawEventIdOne, rawEventIdTwo]));
    // Both entries correlate into the SAME incident — the "index case"
    // behavior, not two separate incidents.
    const correlatedIncidentIds = new Set(locationEntries.rows.map((row: { intrusion_incident_id: string }) => row.intrusion_incident_id));
    expect(correlatedIncidentIds.size).toBe(1);
    expect(correlatedIncidentIds.has(incidents.rows[0].id)).toBe(true);
  });
});
