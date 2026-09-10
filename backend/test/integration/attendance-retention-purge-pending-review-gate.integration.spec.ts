import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { AttendanceMonthlyClosureService } from '../../src/modules/attendance-retention/attendance-monthly-closure.service';
import { AttendancePurgeService } from '../../src/modules/attendance-retention/attendance-purge.service';
import { AttendanceRetentionPendingGateService } from '../../src/modules/attendance-retention/attendance-retention-pending-gate.service';
import { AttendanceRetentionRlsContextService } from '../../src/modules/attendance-retention/attendance-retention-rls-context.service';
import { AttendanceRetentionStorageService } from '../../src/modules/attendance-retention/attendance-retention-storage.service';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// Testing Agent finding, Frente 10 QA "approved with ressalvas": the ONLY
// prior proof that a non-terminal attendance_pending_review blocks the
// RULE-RET-01 purge of its own row across the four source tables was
// attendance-purge.service.spec.ts's mock-EntityManager assertion that the
// generated SQL string CONTAINS "resolved_at IS NULL" — it never ran the
// query against a real database, so it could never have caught a wrong join
// key, a wrong NULL check, or the two-hop
// identification_checkin.raw_identification_event_id join simply being
// wrong. Same escalation precedent already established in this same frente
// for Controle B's bootstrap-race lock
// (attendance-frequency-aggregate-bootstrap-race.integration.spec.ts): when a
// mock-only proof protects something this sensitive (this one guards
// evidence tied to a still-open human review, RULE-ATT-11), it gets a real
// -Postgres companion.
//
// A second, DISTINCT finding surfaces while building this test (see the
// 'coarse month-level gate' describe block below): AttendanceMonthlyClosure
// Service.closeMonth's own eligibility check
// (AttendanceRetentionPendingGateService.monthHasBlockingPendingReview) is
// evaluated over the WHOLE (tenant, month), across all four tables at once —
// not per person/session. One open pendência ANYWHERE in the month prevents
// the month's closure document from being generated AT ALL, which in turn
// means AttendancePurgeService.purgeMonth skips the ENTIRE month (status
// 'skipped', reason 'no_closure_document') — including every OTHER row in
// that month that has nothing to do with the pendência and would otherwise
// be free to purge. This matches the code's own comments (the coarse gate is
// deliberately month-granular; only the row-level re-check inside
// AttendancePurgeService's own DELETE statements is row-granular) but is
// worth stating explicitly: the row-level protection this test's first
// describe block proves is NOT a "surgical, only-this-row" guarantee against
// an already-open pendência sitting in the month at closure time — it only
// ever engages for a pendência that opens AFTER the month has already
// closed (the documented "race" scenario), never before. Flagged in the
// Testing Summary as an architecture clarification, not a code defect — the
// behavior matches what the source comments describe on purpose.
describe('Attendance retention pending-review gate protects source rows from purge (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenantContext: TenantContextService;
  let tenant: TenantFixture;
  let personBlockedId: string;
  let personFreeId: string;
  let classGroupId: string;
  let subjectId: string;
  let roomId: string;
  let deviceId: string;
  let tagCheckinFactorTypeId: string;

  let closureService: AttendanceMonthlyClosureService;
  let purgeService: AttendancePurgeService;
  let rlsContext: AttendanceRetentionRlsContextService;
  let storageUpload: jest.Mock;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'PurgeGate');
    personBlockedId = tenant.personId;

    const personFreeResult = await superuser.query(
      `INSERT INTO person (tenant_id, actor_type_id, full_name) VALUES ($1, $2, $3) RETURNING id`,
      [tenant.tenantId, tenant.actorTypeId, 'Person PurgeGate Free'],
    );
    personFreeId = personFreeResult.rows[0].id as string;

    const courseResult = await superuser.query(`INSERT INTO course (tenant_id, name) VALUES ($1, 'Curso Purge Gate Test') RETURNING id`, [
      tenant.tenantId,
    ]);
    const courseId = courseResult.rows[0].id as string;

    const subjectResult = await superuser.query(
      `INSERT INTO subject (tenant_id, course_id, name) VALUES ($1, $2, 'Materia Purge Gate Test') RETURNING id`,
      [tenant.tenantId, courseId],
    );
    subjectId = subjectResult.rows[0].id as string;

    const classGroupResult = await superuser.query(
      `INSERT INTO class_group (tenant_id, course_id, name, term_start_date, term_end_date)
       VALUES ($1, $2, 'Turma Purge Gate Test', '2026-01-01', '2026-12-31') RETURNING id`,
      [tenant.tenantId, courseId],
    );
    classGroupId = classGroupResult.rows[0].id as string;

    const roomResult = await superuser.query(`INSERT INTO room (tenant_id, name) VALUES ($1, 'Sala Purge Gate Test') RETURNING id`, [
      tenant.tenantId,
    ]);
    roomId = roomResult.rows[0].id as string;

    const deviceResult = await superuser.query(
      `INSERT INTO device (tenant_id, device_type, external_identifier, api_key_id, api_key_secret_hash)
       VALUES ($1, 'raspberry_pi', 'purge-gate-test-device', $2, 'unused-hash')
       RETURNING id`,
      [tenant.tenantId, `purge-gate-test-key-${Date.now()}`],
    );
    deviceId = deviceResult.rows[0].id as string;

    const factorTypeResult = await superuser.query(
      `SELECT id FROM attendance_factor_type WHERE tenant_id IS NULL AND code = 'TAG_CHECKIN'`,
    );
    tagCheckinFactorTypeId = factorTypeResult.rows[0].id as string;

    dataSource = createAppDataSource();
    await dataSource.initialize();
    tenantContext = new TenantContextService(dataSource);

    const pendingGate = new AttendanceRetentionPendingGateService(tenantContext);
    storageUpload = jest.fn().mockResolvedValue(undefined);
    const storageStub = { upload: storageUpload, delete: jest.fn() } as unknown as AttendanceRetentionStorageService;
    closureService = new AttendanceMonthlyClosureService(tenantContext, pendingGate, storageStub);
    purgeService = new AttendancePurgeService(tenantContext);
    rlsContext = new AttendanceRetentionRlsContextService(tenantContext);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await cleanupTenants(superuser, [tenant.tenantId]);
    await superuser.end();
  });

  // Mirrors src/scripts/attendance-retention-close-month.ts exactly:
  // AttendanceRetentionRlsContextService.applyRetentionJobScope() must run
  // INSIDE the same runWithTenant transaction, before touching
  // attendance_closure_document — that table's RLS policy grants the app
  // role no access at all without this GUC (AddAttendanceRetention
  // migration; Open Question 4, "quem pode baixar o documento de
  // fechamento", still unresolved). Confirmed the hard way here: the first
  // draft of this test, without this call, failed with a real Postgres RLS
  // rejection on the INSERT into attendance_closure_document.
  function closeMonthReal(year: number, month: number) {
    return tenantContext.runWithTenant(tenant.tenantId, async () => {
      await rlsContext.applyRetentionJobScope();
      return closureService.closeMonth(tenant.tenantId, year, month);
    });
  }

  function purgeMonthReal(year: number, month: number) {
    return tenantContext.runWithTenant(tenant.tenantId, async () => {
      await rlsContext.applyRetentionJobScope();
      return purgeService.purgeMonth(tenant.tenantId, year, month);
    });
  }

  async function insertClassSession(scheduledStart: string, scheduledEnd: string): Promise<string> {
    const result = await superuser.query(
      `INSERT INTO class_session
         (tenant_id, class_group_id, room_id, subject_id, scheduled_start, scheduled_end, min_attendance_percentage_snapshot, tolerance_minutes_snapshot, post_tolerance_behavior_snapshot)
       VALUES ($1, $2, $3, $4, $5, $6, 75, 10, 'register_only') RETURNING id`,
      [tenant.tenantId, classGroupId, roomId, subjectId, scheduledStart, scheduledEnd],
    );
    return result.rows[0].id as string;
  }

  async function insertSessionAttendanceConsolidation(classSessionId: string, personId: string): Promise<void> {
    await superuser.query(
      `INSERT INTO session_attendance_consolidation (tenant_id, class_session_id, person_id, total_presence_minutes, attendance_percentage, status)
       VALUES ($1, $2, $3, 0, 0, 'absent')`,
      [tenant.tenantId, classSessionId, personId],
    );
  }

  async function insertPendingReview(classSessionId: string, personId: string): Promise<void> {
    await superuser.query(
      `INSERT INTO attendance_pending_review (tenant_id, class_session_id, person_id, reason)
       VALUES ($1, $2, $3, 'missing_exit')`,
      [tenant.tenantId, classSessionId, personId],
    );
  }

  async function sessionAttendanceConsolidationExists(classSessionId: string, personId: string): Promise<boolean> {
    const rows = await superuser.query(
      `SELECT 1 FROM session_attendance_consolidation WHERE tenant_id = $1 AND class_session_id = $2 AND person_id = $3`,
      [tenant.tenantId, classSessionId, personId],
    );
    return rows.rows.length > 0;
  }

  // ---------------------------------------------------------------------
  // Row-level gate (AttendancePurgeService's own DELETE statements):
  // proves the documented "race" scenario for real — a pendência that opens
  // AFTER the month has already closed still blocks that one row's purge,
  // while an unrelated free row in the SAME (tenant, month) is genuinely
  // deleted.
  // ---------------------------------------------------------------------
  describe('row-level gate (pendência opens after monthly closure)', () => {
    const year = 2026;
    const month = 6; // June 2026 ends 2026-07-01; +60 days = 2026-08-30, well before "today".

    test('test_purgeMonth_rowTiedToNonTerminalPendingReviewOpenedAfterClosure_survivesWhileUnrelatedFreeRowIsReallyDeleted_sessionAttendanceConsolidation', async () => {
      const sessionBlockedId = await insertClassSession('2026-06-10T10:00:00.000Z', '2026-06-10T11:00:00.000Z');
      const sessionFreeId = await insertClassSession('2026-06-11T10:00:00.000Z', '2026-06-11T11:00:00.000Z');

      await insertSessionAttendanceConsolidation(sessionBlockedId, personBlockedId);
      await insertSessionAttendanceConsolidation(sessionFreeId, personFreeId);

      // 1. Close the month for real, BEFORE any pendência exists — the month
      // must be eligible (no blocking row yet).
      const closureOutcome = await closeMonthReal(year, month);
      expect(closureOutcome.status).toBe('created');

      // 2. A pendência opens AFTER closure — the documented race the
      // row-level re-check exists for.
      await insertPendingReview(sessionBlockedId, personBlockedId);

      // 3. Purge the month for real.
      const purgeOutcome = await purgeMonthReal(year, month);

      expect(purgeOutcome).toEqual({
        status: 'purged',
        counts: {
          rawIdentificationEventDeleted: 0,
          identificationCheckinDeleted: 0,
          presenceIntervalDeleted: 0,
          sessionAttendanceConsolidationDeleted: 1,
        },
      });

      // 4. Read the real table back — never trust the return value alone.
      await expect(sessionAttendanceConsolidationExists(sessionBlockedId, personBlockedId)).resolves.toBe(true);
      await expect(sessionAttendanceConsolidationExists(sessionFreeId, personFreeId)).resolves.toBe(false);
    });
  });

  // ---------------------------------------------------------------------
  // Two-hop join (raw_identification_event -> identification_checkin ->
  // attendance_pending_review) — item 5's "most fragile to get wrong" case,
  // in identification_checkin (direct join) AND raw_identification_event
  // (the two-hop join) together.
  // ---------------------------------------------------------------------
  describe('row-level gate, two-hop join (raw_identification_event via identification_checkin)', () => {
    const year = 2026;
    const month = 4; // April 2026 ends 2026-05-01; +60 days = 2026-06-30, well before "today".

    async function insertRawEventAndCheckin(
      classSessionId: string,
      personId: string,
      receivedAt: string,
      idempotencyKeySuffix: string,
    ): Promise<{ rawEventId: string; checkinId: string }> {
      const rawEventResult = await superuser.query(
        `INSERT INTO raw_identification_event (tenant_id, device_id, event_type, idempotency_key, raw_payload, received_at)
         VALUES ($1, $2, 'TAG_CHECKIN', $3, $4, $5) RETURNING id`,
        [
          tenant.tenantId,
          deviceId,
          `idem-purge-gate-${idempotencyKeySuffix}-${Date.now()}-${Math.random()}`,
          JSON.stringify({ capturedAt: receivedAt, roomId: null, data: {} }),
          receivedAt,
        ],
      );
      const rawEventId = rawEventResult.rows[0].id as string;

      const checkinResult = await superuser.query(
        `INSERT INTO identification_checkin (tenant_id, raw_identification_event_id, person_id, class_session_id, attendance_factor_type_id, checkin_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [tenant.tenantId, rawEventId, personId, classSessionId, tagCheckinFactorTypeId, receivedAt],
      );
      const checkinId = checkinResult.rows[0].id as string;

      return { rawEventId, checkinId };
    }

    async function rowExists(table: string, id: string): Promise<boolean> {
      const rows = await superuser.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]);
      return rows.rows.length > 0;
    }

    test('test_purgeMonth_rawIdentificationEventAndCheckinTiedToNonTerminalPendingReviewViaTwoHopJoin_surviveWhileUnrelatedFreeRowsAreReallyDeleted', async () => {
      const sessionBlockedId = await insertClassSession('2026-04-10T10:00:00.000Z', '2026-04-10T11:00:00.000Z');
      const sessionFreeId = await insertClassSession('2026-04-11T10:00:00.000Z', '2026-04-11T11:00:00.000Z');

      const blocked = await insertRawEventAndCheckin(sessionBlockedId, personBlockedId, '2026-04-10T10:05:00.000Z', 'blocked');
      const free = await insertRawEventAndCheckin(sessionFreeId, personFreeId, '2026-04-11T10:05:00.000Z', 'free');

      // 1. Close the month for real, before any pendência exists.
      const closureOutcome = await closeMonthReal(year, month);
      expect(closureOutcome.status).toBe('created');

      // 2. A pendência opens AFTER closure, tied to the blocked checkin's
      // (class_session_id, person_id) — reachable from raw_identification_event
      // only through identification_checkin.raw_identification_event_id, the
      // two-hop join under test.
      await insertPendingReview(sessionBlockedId, personBlockedId);

      // 3. Purge the month for real.
      const purgeOutcome = await purgeMonthReal(year, month);

      expect(purgeOutcome).toEqual({
        status: 'purged',
        counts: {
          rawIdentificationEventDeleted: 1,
          identificationCheckinDeleted: 1,
          presenceIntervalDeleted: 0,
          sessionAttendanceConsolidationDeleted: 0,
        },
      });

      // 4. Read the real tables back — never trust the return value alone.
      await expect(rowExists('identification_checkin', blocked.checkinId)).resolves.toBe(true);
      await expect(rowExists('raw_identification_event', blocked.rawEventId)).resolves.toBe(true);
      await expect(rowExists('identification_checkin', free.checkinId)).resolves.toBe(false);
      await expect(rowExists('raw_identification_event', free.rawEventId)).resolves.toBe(false);
    });
  });

  // ---------------------------------------------------------------------
  // Coarse, month-level gate (AttendanceMonthlyClosureService's own
  // eligibility check): a pendência already open WHEN the month is due to
  // close blocks the closure document from being generated at all — and
  // therefore blocks the purge of EVERY row in that month, including the
  // unrelated free one, not just the row tied to the pendência. See the
  // describe-level comment above for why this is being flagged as an
  // architecture clarification rather than treated as equivalent to the
  // row-level scenario above.
  // ---------------------------------------------------------------------
  describe('coarse month-level gate (pendência already open at closure time)', () => {
    const year = 2026;
    const month = 5; // May 2026 ends 2026-06-01; +60 days = 2026-07-31, well before "today".

    test('test_closeMonth_pendingReviewAlreadyOpenAnywhereInMonth_blocksClosureForTheWholeMonth_andPurgeSkipsEverything', async () => {
      const sessionBlockedId = await insertClassSession('2026-05-10T10:00:00.000Z', '2026-05-10T11:00:00.000Z');
      const sessionFreeId = await insertClassSession('2026-05-11T10:00:00.000Z', '2026-05-11T11:00:00.000Z');

      await insertSessionAttendanceConsolidation(sessionBlockedId, personBlockedId);
      await insertSessionAttendanceConsolidation(sessionFreeId, personFreeId);

      // The pendência is open BEFORE closure even runs this time.
      await insertPendingReview(sessionBlockedId, personBlockedId);

      const closureOutcome = await closeMonthReal(year, month);
      expect(closureOutcome).toEqual({ status: 'not_yet_eligible', reason: 'blocking_pending_review' });
      expect(storageUpload).not.toHaveBeenCalledWith(expect.stringContaining(`${year}-05`), expect.anything(), expect.anything());

      const purgeOutcome = await purgeMonthReal(year, month);
      expect(purgeOutcome).toEqual({ status: 'skipped', reason: 'no_closure_document' });

      // Neither row was purged — including the one with no pendência at all.
      await expect(sessionAttendanceConsolidationExists(sessionBlockedId, personBlockedId)).resolves.toBe(true);
      await expect(sessionAttendanceConsolidationExists(sessionFreeId, personFreeId)).resolves.toBe(true);
    });
  });
});
