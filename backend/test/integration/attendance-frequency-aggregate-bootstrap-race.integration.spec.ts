import { Client } from 'pg';
import { DataSource, EntityManager } from 'typeorm';
import { AccumulatedFrequencyPeriod } from '../../src/modules/config/accumulated-frequency-period.enum';
import { AttendanceFrequencyEngineService } from '../../src/modules/attendance-frequency/attendance-frequency-engine.service';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// Minimal stand-in for TenantContextService, bound to ONE already-open
// transaction's EntityManager (a manually-managed QueryRunner, not
// dataSource.transaction()'s auto-commit-on-return) — same structural-typing
// substitution technique, and the same reason for it, as
// intrusion-detection-open-incident-race.integration.spec.ts: it exists
// purely so this test can hold a transaction open across an await boundary
// and control exactly when it commits, which
// TenantContextService.runWithTenant's single commit-on-return call cannot
// do.
interface StubTenantContext {
  getManager(): EntityManager;
  getTenantId(): string;
}

function stubTenantContext(manager: EntityManager, tenantId: string): StubTenantContext {
  return { getManager: () => manager, getTenantId: () => tenantId };
}

// Dummy TenantConfigService/AttendanceWarningService stand-ins — neither is
// the mechanism under test here (the advisory lock), and both are exercised
// for real by attendance-frequency-engine.service.spec.ts and
// attendance-warning.service.spec.ts already. resolveEffectiveConfig must
// return a real bimester config, since recalculateForSessionPerson (unlike
// the private readOrUpdateAggregate this test used to call directly) resolves
// it itself, through loadClassGroupContext, on every call.
function stubTenantConfig() {
  return {
    resolveEffectiveConfig: async () => ({
      minAccumulatedFrequencyPercentage: 75,
      accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod.BIMESTER,
    }),
  };
}

function stubWarningService() {
  return { applyCalculation: async () => undefined };
}

// LOST-UPDATE FIX regression test (Testing Agent finding, Frente 10, closing
// a known coverage gap: the only prior proof of this fix was a unit spec —
// attendance-frequency-engine.service.spec.ts, "Frente 10 — lost-update fix"
// describe block — built on a hand-rolled JS mutex standing in for
// pg_advisory_xact_lock's behaviour. A mock-based spec is structurally
// incapable of proving Postgres's OWN transaction-scoped advisory-lock
// blocking actually works the way the fix assumes; this test drives two
// REAL, genuinely concurrent Postgres transactions/connections against the
// real database instead, same pattern already established by
// intrusion-detection-open-incident-race.integration.spec.ts and
// deduplication-window-boundary.integration.spec.ts.
//
// THE RACE (see readOrUpdateAggregate's own header comment in
// attendance-frequency-engine.service.ts): two transactions touching
// DIFFERENT class_session rows of the SAME (tenant, person, class_group,
// subject, reporting period) at once — e.g. two PendingReviewService.
// resolve() calls on different sessions, or one resolve() racing a
// concurrent reconcileForPerson() read — each see no
// attendance_frequency_period_aggregate row yet (neither has committed) and
// would, pre-fix, each run their OWN full rescan seeing only their own
// uncommitted write. Whichever commits first wins the bootstrap INSERT; the
// loser's ON CONFLICT DO NOTHING fallback SELECT would hand back the
// winner's row and the engine would return it AS-IS — silently discarding
// the loser's own session's contribution to present_count/considered_count
// forever, with no error and (after RULE-RET-01's 60-day purge of
// session_attendance_consolidation) no way to audit it back. The fix
// (pg_advisory_xact_lock(hashtext(key)), taken before the check-then-act
// sequence) must make the second transaction BLOCK — for real, at the
// Postgres level — until the first commits, then re-run its own
// check-then-act against the NOW-current row so it applies its OWN diff on
// top instead of ever accepting the winner's row unmodified.
//
// UPGRADED TO DRIVE THE PUBLIC ENTRY POINT (recalculateForSessionPerson),
// end-to-end, as this test's own header used to flag as pending: it
// originally had to call the PRIVATE readOrUpdateAggregate directly, via a
// structural cast bypassing `private`, because recalculateForSessionPerson's
// own path (recalculate() -> currentPeriodWindow(classGroup.termStartDate,
// classGroup.termEndDate, ...) -> utcMidnight() -> extractUtcYmd()) called
// date.getUTCFullYear() directly on class_group.term_start_date/
// term_end_date — `type: 'date'` columns that TypeORM hydrates as PLAIN
// STRINGS, not Date objects, when read through a repository (repository.
// findOneBy()/manager.getRepository(...).findOneBy(), unlike a raw
// manager.query() on the same column). That has since been fixed (Backend
// Agent): every such call site now hydrates the column defensively before
// touching it (hydrateNullableDate / `new Date(...)`, mirroring the
// precedent AttendanceWarningService.storedWindow already established). This
// test now exercises that real hydration path too: the class_group row
// below is inserted with genuine term_start_date/term_end_date columns, read
// back the ordinary way (through AttendanceFrequencyEngineService's own
// loadClassGroupContext -> manager.getRepository(ClassGroupEntity).
// findOneBy), and the window each transaction computes comes from that
// read-back, hydrated value — not a literal Date built in the test itself.
describe('AttendanceFrequencyEngineService concurrent aggregate bootstrap race (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenant: TenantFixture;
  let classGroupId: string;
  let subjectId: string;
  let sessionAId: string;
  let sessionBId: string;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'FreqAggregateRace');

    const courseResult = await superuser.query(`INSERT INTO course (tenant_id, name) VALUES ($1, 'Curso Race Test') RETURNING id`, [
      tenant.tenantId,
    ]);
    const courseId = courseResult.rows[0].id as string;

    const subjectResult = await superuser.query(
      `INSERT INTO subject (tenant_id, course_id, name) VALUES ($1, $2, 'Materia Race Test') RETURNING id`,
      [tenant.tenantId, courseId],
    );
    subjectId = subjectResult.rows[0].id as string;

    // term_start_date/term_end_date set on the real row, read back through
    // the ordinary repository path below (not a literal Date) — see the
    // class-level comment for why this is now load-bearing for this test.
    const classGroupResult = await superuser.query(
      `INSERT INTO class_group (tenant_id, course_id, name, term_start_date, term_end_date)
       VALUES ($1, $2, 'Turma Race Test', '2026-08-01', '2026-12-31') RETURNING id`,
      [tenant.tenantId, courseId],
    );
    classGroupId = classGroupResult.rows[0].id as string;

    const roomResult = await superuser.query(`INSERT INTO room (tenant_id, name) VALUES ($1, 'Sala Race Test') RETURNING id`, [
      tenant.tenantId,
    ]);
    const roomId = roomResult.rows[0].id as string;

    // Two DIFFERENT class_session rows of the SAME (person, turma, matéria) —
    // the whole premise of the race: two sessions, one person, one aggregate
    // identity, both within the bimester the class_group's term dates above
    // resolve to (Aug 1 - Sep 30 2026).
    const sessionAResult = await superuser.query(
      `INSERT INTO class_session
         (tenant_id, class_group_id, room_id, subject_id, scheduled_start, scheduled_end, min_attendance_percentage_snapshot, tolerance_minutes_snapshot, post_tolerance_behavior_snapshot)
       VALUES ($1, $2, $3, $4, '2026-09-05T10:00:00Z', '2026-09-05T11:00:00Z', 75, 10, 'register_only') RETURNING id`,
      [tenant.tenantId, classGroupId, roomId, subjectId],
    );
    sessionAId = sessionAResult.rows[0].id as string;

    const sessionBResult = await superuser.query(
      `INSERT INTO class_session
         (tenant_id, class_group_id, room_id, subject_id, scheduled_start, scheduled_end, min_attendance_percentage_snapshot, tolerance_minutes_snapshot, post_tolerance_behavior_snapshot)
       VALUES ($1, $2, $3, $4, '2026-09-06T10:00:00Z', '2026-09-06T11:00:00Z', 75, 10, 'register_only') RETURNING id`,
      [tenant.tenantId, classGroupId, roomId, subjectId],
    );
    sessionBId = sessionBResult.rows[0].id as string;

    dataSource = createAppDataSource();
    await dataSource.initialize();
  });

  afterAll(async () => {
    await dataSource.destroy();
    await cleanupTenants(superuser, [tenant.tenantId]);
    await superuser.end();
  });

  test('test_recalculateForSessionPerson_twoSessionsOfSamePersonTurmaMateriaPeriod_concurrentBootstraps_aggregateReflectsBothContributionsNeitherIsLost', async () => {
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
    const serviceA = new AttendanceFrequencyEngineService(contextA as never, stubTenantConfig() as never, stubWarningService() as never);
    const serviceB = new AttendanceFrequencyEngineService(contextB as never, stubTenantConfig() as never, stubWarningService() as never);

    try {
      // Transaction A — PendingReviewService.resolve() style: session A's
      // consolidation row is written 'absent' FIRST, in the same
      // transaction, immediately before calling recalculateForSessionPerson
      // — exactly the contract the engine's own header comment documents
      // ("every caller writes session_attendance_consolidation BEFORE
      // calling recalculateForSessionPerson").
      await queryRunnerA.manager.query(
        `INSERT INTO session_attendance_consolidation (tenant_id, class_session_id, person_id, total_presence_minutes, attendance_percentage, status)
         VALUES ($1, $2, $3, 0, 0, 'absent')`,
        [tenant.tenantId, sessionAId, tenant.personId],
      );

      // T1 (serviceA) runs to completion: no aggregate row exists yet for
      // this (person, turma, matéria, período), so it bootstraps via the
      // full rescan — which, at this exact moment, can only see session A's
      // own (uncommitted, same-transaction) consolidation row, since session
      // B's row does not exist in ANY transaction yet. T1's transaction is
      // deliberately kept open afterward, uncommitted: pg_advisory_xact_lock
      // is transaction-scoped and releases ONLY on commit/rollback, so
      // holding it open is what forces T2 below to genuinely BLOCK on the
      // real Postgres lock, not merely race it.
      const resultA = await serviceA.recalculateForSessionPerson(sessionAId, tenant.personId, null);
      expect(resultA).toEqual({ calculable: true, presentCount: 0, consideredCount: 1, percentage: 0 });

      // Transaction B — a DIFFERENT session of the SAME (person, turma,
      // matéria, período) reaching the engine concurrently: e.g. a second
      // PendingReviewService.resolve() call, or reconcileForPerson()'s lazy
      // read-path reconciliation, racing T1 before it commits.
      await queryRunnerB.manager.query(
        `INSERT INTO session_attendance_consolidation (tenant_id, class_session_id, person_id, total_presence_minutes, attendance_percentage, status)
         VALUES ($1, $2, $3, 100, 100, 'present')`,
        [tenant.tenantId, sessionBId, tenant.personId],
      );

      let bResolved = false;
      const callB = serviceB.recalculateForSessionPerson(sessionBId, tenant.personId, null).then((result) => {
        bResolved = true;
        return result;
      });

      // Generous margin for T2's lockAggregateIdentity call to actually
      // reach — and block on — pg_advisory_xact_lock: local Postgres round
      // trips are sub-millisecond, so this is not a tight timing race. T2
      // has nowhere else to go until T1 releases the lock.
      await new Promise((resolve) => setTimeout(resolve, 200));

      // THE ASSERTION THAT PROVES REAL SERIALIZATION, not mere ordering
      // luck: T2 must still be genuinely blocked/unresolved at this point.
      // pg_advisory_xact_lock is a real, transaction-scoped Postgres lock
      // and T1 has not released it yet — if this ever reads true, the lock
      // is not actually serializing the two transactions.
      expect(bResolved).toBe(false);

      // Releases T1's advisory lock (transaction-scoped: COMMIT is the only
      // way to let it go here), unblocking T2's pending
      // pg_advisory_xact_lock call — the exact scenario the fix's lock must
      // serialize T2 behind, so T2 re-reads the NOW-committed aggregate row
      // instead of racing T1 to bootstrap it a second time.
      await queryRunnerA.commitTransaction();

      const resultB = await callB;
      expect(bResolved).toBe(true);

      // THE BUG THIS TEST CLOSES: B must never simply inherit A's committed
      // row (considered=1, present=0) as its own final answer — it has its
      // OWN session (session B, 'present', previousStatus null) to add on
      // top. Pre-fix, without the lock, B could have read the aggregate
      // table BEFORE A's row existed (the genuine check-then-act race at
      // READ COMMITTED this fix closes), run its OWN full rescan seeing only
      // its own uncommitted consolidation row, lost the race on the
      // bootstrap INSERT, and fallen into the ON CONFLICT DO NOTHING
      // fallback SELECT — silently discarding session A's contribution
      // forever. Both `calculable` AND the exact numbers are asserted here
      // now: the separate applyAggregateDelta tuple-destructuring defect the
      // original version of this test had to work around (TypeORM's
      // Postgres driver returning `[rows, rowCount]` for UPDATE...RETURNING,
      // not `rows` directly) has since been fixed too, so the in-process
      // return value is exactly as trustworthy as the row-level assertion
      // below.
      expect(resultB).toEqual({ calculable: true, presentCount: 1, consideredCount: 2, percentage: 50 });

      await queryRunnerB.commitTransaction();
    } finally {
      await queryRunnerA.release();
      await queryRunnerB.release();
    }

    // Final, durable proof against the real table: exactly ONE aggregate row
    // for this (person, turma, matéria, período), reflecting BOTH sessions'
    // contributions — not the value a partial/racing rescan on either side
    // alone would have produced.
    const aggregateRows = await superuser.query(
      `SELECT present_count, considered_count FROM attendance_frequency_period_aggregate
       WHERE tenant_id = $1 AND person_id = $2 AND class_group_id = $3 AND subject_id = $4`,
      [tenant.tenantId, tenant.personId, classGroupId, subjectId],
    );
    expect(aggregateRows.rows).toHaveLength(1);
    expect(Number(aggregateRows.rows[0].present_count)).toBe(1);
    expect(Number(aggregateRows.rows[0].considered_count)).toBe(2);
  });
});
