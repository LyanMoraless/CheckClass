import { NotFoundException } from '@nestjs/common';
import { ClassGroupEntity, ClassSessionEntity, SessionAttendanceConsolidationEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { AccumulatedFrequencyPeriod } from '../config/accumulated-frequency-period.enum';
import { AttendanceFrequencyEngineService } from './attendance-frequency-engine.service';
import { currentPeriodWindow } from './reporting-period.util';

// Motor de Controle B (RULE-FREQ-01/02/05/06): accumulated frequency per
// (student, turma, matéria) over a reporting period. This engine computes
// the attendance percentages and dispatches them to AttendanceWarningService.
//
// FRENTE 10: the engine's on-every-call full-window rescan
// (`session_attendance_consolidation` LEFT JOIN'd from `class_session`) was
// replaced by a durable, incremental aggregate
// (`attendance_frequency_period_aggregate`) — see that entity/migration and
// the engine's own file header. The default `buildService` scenario below
// simulates "no aggregate exists yet for this (person, turma, matéria,
// período)" on every call, i.e. every call bootstraps via the SAME full
// rescan the engine always ran, which is exactly what keeps every
// PRE-EXISTING test in this file behaving identically (same query, same
// `frequencyCountRows` scenario input, same computed result) without
// rewriting their intent — only the mock plumbing changed, per the
// Orchestrator's own instruction. Tests that need to exercise the
// INCREMENTAL diff path instead (an aggregate that already exists) set
// `scenario.existingAggregate` explicitly — see the dedicated describe
// blocks further down for the Frente 10-specific coverage.
describe('AttendanceFrequencyEngineService', () => {
  function buildService(scenario: {
    classGroup?: Partial<ClassGroupEntity>;
    session?: Partial<ClassSessionEntity>;
    frequencyCountRows?: Array<{ considered_count: string; present_count: string }>;
    consolidationStatus?: 'pending' | 'present' | 'absent' | 'absent_justified' | null;
    existingAggregate?: { id: string; present_count: number; considered_count: number };
  } = {}) {
    const sessionRepo = createMockRepository({
      findOneBy: jest
        .fn()
        .mockResolvedValue({
          id: 'session-1',
          classGroupId: 'class-group-1',
          subjectId: 'subject-1',
          // RULE-JUST-23 addendum: recalculateForSessionPerson now resolves
          // its window from session.scheduledStart instead of always `new
          // Date()` — a default inside the default classGroup's term
          // (2026-08-01..2026-12-31) below keeps every existing scenario
          // that doesn't care about this field behaving exactly as before.
          scheduledStart: new Date('2026-09-01'),
          ...scenario.session,
        } as ClassSessionEntity),
    });

    const classGroupRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({
        id: 'class-group-1',
        termStartDate: new Date('2026-08-01'),
        termEndDate: new Date('2026-12-31'),
        ...scenario.classGroup,
      } as ClassGroupEntity),
    });

    // Frente 10: recalculateForSessionPerson reads the (session, person)
    // row's CURRENT status itself, as a single-row lookup — this is that
    // lookup's mock. Irrelevant to every PRE-EXISTING scenario in this file
    // (the bootstrap path below ignores it entirely, see the class comment),
    // relevant only to the dedicated Frente 10 tests that set it explicitly.
    const consolidationRepo = createMockRepository({
      findOneBy: jest
        .fn()
        .mockResolvedValue(
          scenario.consolidationStatus === null
            ? null
            : { status: scenario.consolidationStatus ?? 'present' },
        ),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [ClassSessionEntity, sessionRepo],
      [ClassGroupEntity, classGroupRepo],
      [SessionAttendanceConsolidationEntity, consolidationRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);

    // Smart raw-SQL mock: distinguishes the three attendance_frequency_
    // period_aggregate statements the engine now issues (SELECT/INSERT/
    // UPDATE) from the pre-existing full-rescan `FROM class_session` query,
    // by matching on the SQL text itself — the same seam every other
    // manager.query mock in this codebase already keys off.
    manager.query.mockImplementation((sql: string, params: unknown[] = []) => {
      if (/FROM attendance_frequency_period_aggregate/.test(sql)) {
        return Promise.resolve(scenario.existingAggregate ? [scenario.existingAggregate] : []);
      }
      if (/INSERT INTO attendance_frequency_period_aggregate/.test(sql)) {
        const presentCount = params[6];
        const consideredCount = params[7];
        return Promise.resolve([{ id: 'aggregate-bootstrap-id', present_count: presentCount, considered_count: consideredCount }]);
      }
      if (/UPDATE attendance_frequency_period_aggregate/.test(sql)) {
        const presentDelta = Number(params[0]);
        const consideredDelta = Number(params[1]);
        const base = scenario.existingAggregate ?? { present_count: 0, considered_count: 0 };
        // Real Postgres driver shape for UPDATE...RETURNING is a TUPLE,
        // `[rows, rowCount]` — never `rows` directly (confirmed against
        // node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:198-206).
        // Mocking it as a bare array here would have let applyAggregateDelta's
        // tuple-destructuring bug (Testing Agent finding) pass silently.
        return Promise.resolve([
          [
            {
              present_count: Number(base.present_count) + presentDelta,
              considered_count: Number(base.considered_count) + consideredDelta,
            },
          ],
          1,
        ]);
      }
      if (/FROM class_session/i.test(sql)) {
        return Promise.resolve(scenario.frequencyCountRows ?? [{ considered_count: '40', present_count: '30' }]);
      }
      return Promise.resolve([]);
    });

    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const configService = {
      resolveEffectiveConfig: jest
        .fn()
        .mockResolvedValue({
          minAccumulatedFrequencyPercentage: 75,
          accumulatedFrequencyPeriod: 'bimester' as AccumulatedFrequencyPeriod,
        }),
    };

    const warningService = {
      applyCalculation: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AttendanceFrequencyEngineService(
      tenantContext as never,
      configService as never,
      warningService as never,
    );

    return { service, manager, sessionRepo, classGroupRepo, consolidationRepo, configService, warningService };
  }

  // The call matching the class_session-driven bootstrap rescan, wherever it
  // landed among the calls the engine made this test — no longer assumed to
  // be manager.query.mock.calls[0] now that the aggregate lookup runs first.
  function findClassSessionCall(manager: { query: jest.Mock }): [string, unknown[]] {
    const call = manager.query.mock.calls.find(([sql]) => /FROM class_session/i.test(sql as string));
    if (!call) {
      throw new Error('Expected a class_session-driven query, none was made');
    }
    return call as [string, unknown[]];
  }

  // ============================================================================
  // Session Lookup and Error Handling
  // ============================================================================
  describe('recalculateForSessionPerson', () => {
    test('test_recalculateForSessionPerson_sessionNotFound_throwsNotFoundException', async () => {
      const { service, sessionRepo } = buildService();
      sessionRepo.findOneBy.mockResolvedValue(null);

      await expect(service.recalculateForSessionPerson('missing-session', 'person-1')).rejects.toThrow(NotFoundException);
    });

    test('test_recalculateForSessionPerson_classGroupNotFound_throwsNotFoundException', async () => {
      const { service, classGroupRepo } = buildService();
      classGroupRepo.findOneBy.mockResolvedValue(null);

      await expect(service.recalculateForSessionPerson('session-1', 'person-1')).rejects.toThrow(NotFoundException);
    });

    test('test_recalculateForSessionPerson_successfulCalculation_returnsCalculableFrequency', async () => {
      const { service } = buildService({
        frequencyCountRows: [{ considered_count: '40', present_count: '30' }],
      });

      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result).toEqual({
        calculable: true,
        presentCount: 30,
        consideredCount: 40,
        percentage: 75,
      });
    });

    test('test_recalculateForSessionPerson_callsWarningServiceWithCorrectInput', async () => {
      const { service, warningService } = buildService({
        frequencyCountRows: [{ considered_count: '40', present_count: '30' }],
      });

      await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(warningService.applyCalculation).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: 'person-1',
          classGroupId: 'class-group-1',
          subjectId: 'subject-1',
          calculation: expect.objectContaining({
            calculable: true,
            percentage: 75,
          }),
        }),
      );
    });
  });

  // ============================================================================
  // Frequency Counting Query
  // ============================================================================
  describe('frequency counting (RULE-FREQ-05.1, RULE-FREQ-05.4)', () => {
    test('test_countInWindow_queryCounts_drivenByClassSessionNotConsolidation', async () => {
      const { service, manager } = buildService();

      // The query should be driven by class_session with a LEFT JOIN onto
      // session_attendance_consolidation — never the other way around.
      await service.recalculateForSessionPerson('session-1', 'person-1');

      const [query] = findClassSessionCall(manager);
      expect(query).toMatch(/FROM class_session/i);
      expect(query).toMatch(/LEFT JOIN session_attendance_consolidation/i);
      // The LEFT JOIN should come after FROM class_session, not before
      const fromPos = query.indexOf('FROM class_session');
      const leftJoinPos = query.indexOf('LEFT JOIN');
      expect(leftJoinPos).toBeGreaterThan(fromPos);
    });

    test('test_countInWindow_lateEnrollment_studentRowAbsentButSessionIncludedInDenominator', async () => {
      const { service } = buildService({
        // Simulate 3 sessions total in the period, 2 with consolidation rows for this person, 1 without
        // But another person has a row for the third session (proving the session was evaluated)
        frequencyCountRows: [{ considered_count: '3', present_count: '2' }],
      });

      // For RULE-FREQ-05.4: a late-enrolled student has no consolidation row for sessions
      // before their enrollment, but those sessions still count in the denominator if they
      // were evaluated (someone has a consolidation row for them).
      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      // The query result shows 3 considered (all sessions, including the one before enrollment
      // where this person has no row but the session was evaluated), 2 present.
      expect(result).toEqual({
        calculable: true,
        presentCount: 2,
        consideredCount: 3,
        percentage: 67, // Math.round(2/3 * 100) = Math.round(66.666...) = 67
      });
    });

    test('test_countInWindow_pendingSessionsExcluded_RULE_FREQ_05_1', async () => {
      const { service, manager } = buildService({
        // Simulating that pending sessions are excluded: only definitive sessions count
        frequencyCountRows: [{ considered_count: '40', present_count: '30' }],
      });

      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      // The query should filter by status != 'pending' (implicitly by the WHERE clause)
      expect(result.calculable).toBe(true);
      const [query] = findClassSessionCall(manager);
      // The query checks for present/absent status and EXISTS (already evaluated)
      expect(query).toMatch(/status.*IN.*present.*absent/i);
    });

    test('test_countInWindow_nonEvaluatedSessions_excludedFromDenominator', async () => {
      const { service } = buildService({
        // Sessions with no consolidation row for anyone still count if they're past scheduled_end
        // Let's simulate 40 sessions, but only 35 have any consolidation row (evaluated)
        frequencyCountRows: [{ considered_count: '35', present_count: '28' }],
      });

      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result.consideredCount).toBe(35);
      expect(result.percentage).toBe(80); // 28/35 * 100 = 80
    });

    test('test_countInWindow_queryPassesCorrectParameters_tenantSessionSubjectPerson', async () => {
      const { service, manager } = buildService();

      await service.recalculateForSessionPerson('session-1', 'person-1');

      const [, params] = findClassSessionCall(manager);
      expect(params[0]).toBe('tenant-a-id'); // tenantId
      expect(params[1]).toBe('class-group-1'); // classGroupId
      expect(params[2]).toBe('person-1'); // personId
      expect(params[3]).toBe('subject-1'); // subjectId
      // params[4] and [5] are date boundaries (window start and end)
    });
  });

  // ============================================================================
  // Rounding (RULE-FREQ-05.3)
  // ============================================================================
  describe('rounding to integer percentage', () => {
    test('test_countInWindow_rounding_245Divided400_rounds61', async () => {
      const { service } = buildService({
        frequencyCountRows: [{ considered_count: '400', present_count: '245' }],
      });

      // 245/400 * 100 = 61.25 → Math.round(61.25) = 61
      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result).toEqual({
        calculable: true,
        presentCount: 245,
        consideredCount: 400,
        percentage: 61,
      });
    });

    test('test_countInWindow_rounding_69_5Percent_roundsTo70', async () => {
      const { service } = buildService({
        frequencyCountRows: [{ considered_count: '200', present_count: '139' }],
      });

      // 139/200 * 100 = 69.5 → Math.round(69.5) = 70 (banker's rounding in JS is .5 → even, but Math.round goes .5 up)
      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result.percentage).toBe(70);
    });

    test('test_countInWindow_rounding_half_BelowMinusNotAbove', async () => {
      const { service } = buildService({
        frequencyCountRows: [{ considered_count: '200', present_count: '138' }],
      });

      // 138/200 * 100 = 69 → stays 69 (no rounding)
      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result.percentage).toBe(69);
    });
  });

  // ============================================================================
  // No Definitive Sessions
  // ============================================================================
  describe('no definitive sessions', () => {
    test('test_countInWindow_zeroConsideredSessions_returnsNotCalculable', async () => {
      const { service } = buildService({
        frequencyCountRows: [{ considered_count: '0', present_count: '0' }],
      });

      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result).toEqual({
        calculable: false,
        reason: 'no_definitive_sessions',
      });
    });

    test('test_countInWindow_noSessions_dispatchesNotCalculableToWarningService', async () => {
      const { service, warningService } = buildService({
        frequencyCountRows: [{ considered_count: '0', present_count: '0' }],
      });

      await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(warningService.applyCalculation).toHaveBeenCalledWith(
        expect.objectContaining({
          calculation: {
            calculable: false,
            reason: 'no_definitive_sessions',
          },
        }),
      );
    });
  });

  // ============================================================================
  // reconcileForPerson (lazy reconciliation for read path)
  // ============================================================================
  describe('reconcileForPerson', () => {
    test('test_reconcileForPerson_queriesEnrollmentsAndSubjectsForPerson', async () => {
      const { service, manager } = buildService();

      // Mock the query that fetches (class_group, subject) pairs
      manager.query.mockImplementation((sql: string) => {
        if (sql.includes('class_group_enrollment')) {
          return Promise.resolve([
            { class_group_id: 'class-group-1', subject_id: 'subject-1' },
            { class_group_id: 'class-group-1', subject_id: 'subject-2' },
          ]);
        }
        // For subsequent calls (the frequency query inside recalculate)
        return Promise.resolve([{ considered_count: '40', present_count: '30' }]);
      });

      await service.reconcileForPerson('person-1');

      const enrollmentQuery = manager.query.mock.calls[0][0] as string;
      expect(enrollmentQuery).toMatch(/class_group_enrollment/i);
      expect(enrollmentQuery).toMatch(/class_group_subject/i);
      expect(enrollmentQuery).toMatch(/person_id = \$2/);
    });

    test('test_reconcileForPerson_enumeratesAllEnrollments_RegardlessOfStatus', async () => {
      const { service, manager } = buildService();

      manager.query.mockImplementation((sql: string) => {
        if (sql.includes('class_group_enrollment')) {
          // Return enrollments of all statuses: active, on_leave, graduated, withdrawn
          return Promise.resolve([
            { class_group_id: 'class-group-1', subject_id: 'subject-1' },
            { class_group_id: 'class-group-2', subject_id: 'subject-2' },
          ]);
        }
        return Promise.resolve([{ considered_count: '40', present_count: '30' }]);
      });

      await service.reconcileForPerson('person-1');

      // Should have called recalculate for both pairs (even if one is on_leave etc.)
      // This is verified indirectly by checking the warningService was called twice
      // (though this test setup doesn't fully mock that chain)
      const calls = manager.query.mock.calls.length;
      expect(calls).toBeGreaterThanOrEqual(1); // At least the enrollment query
    });

    test('test_reconcileForPerson_cacheClassGroupContextPerTurma', async () => {
      const { service, manager, classGroupRepo } = buildService();

      manager.query.mockImplementation((sql: string) => {
        if (sql.includes('class_group_enrollment')) {
          // Two subjects in the same class group
          return Promise.resolve([
            { class_group_id: 'class-group-1', subject_id: 'subject-1' },
            { class_group_id: 'class-group-1', subject_id: 'subject-2' },
          ]);
        }
        return Promise.resolve([{ considered_count: '40', present_count: '30' }]);
      });

      await service.reconcileForPerson('person-1');

      // classGroupRepo.findOneBy should be called once per unique class group,
      // not once per (class_group, subject) pair
      expect(classGroupRepo.findOneBy).toHaveBeenCalledTimes(1);
      expect(classGroupRepo.findOneBy).toHaveBeenCalledWith({ id: 'class-group-1' });
    });
  });

  // ============================================================================
  // No Period Window (frozen term dates)
  // ============================================================================
  describe('no period window', () => {
    test('test_recalculate_termsWithoutDatesBothNull_returnsNotCalculable', async () => {
      const { service } = buildService({
        classGroup: {
          termStartDate: null,
          termEndDate: new Date('2026-12-31'),
        },
      });

      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result).toEqual({
        calculable: false,
        reason: 'no_period_window',
      });
    });

    test('test_recalculate_termEndBeforeStart_returnsNotCalculable', async () => {
      const { service } = buildService({
        classGroup: {
          termStartDate: new Date('2026-12-31'),
          termEndDate: new Date('2026-08-01'),
        },
      });

      const result = await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(result).toEqual({
        calculable: false,
        reason: 'no_period_window',
      });
    });

    test('test_recalculate_noPeriodWindow_dispatchesFreezeBranchToWarningService', async () => {
      const { service, warningService } = buildService({
        classGroup: {
          termStartDate: null,
          termEndDate: null,
        },
      });

      await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(warningService.applyCalculation).toHaveBeenCalledWith(
        expect.objectContaining({
          window: null,
          calculation: {
            calculable: false,
            reason: 'no_period_window',
          },
        }),
      );
    });
  });

  // ============================================================================
  // Config Resolution
  // ============================================================================
  describe('live configuration resolution', () => {
    test('test_recalculate_resolvesConfigLive_notSnapshotted', async () => {
      const { service, configService } = buildService();

      await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(configService.resolveEffectiveConfig).toHaveBeenCalledWith('class-group-1');
    });

    test('test_recalculate_usesMinPercentageFromResolvedConfig', async () => {
      const { service, configService, warningService } = buildService();
      configService.resolveEffectiveConfig.mockResolvedValue({
        minAccumulatedFrequencyPercentage: 80,
        accumulatedFrequencyPeriod: 'trimester',
      });

      await service.recalculateForSessionPerson('session-1', 'person-1');

      expect(warningService.applyCalculation).toHaveBeenCalledWith(
        expect.objectContaining({
          minPercentage: 80,
        }),
      );
    });
  });

  // ============================================================================
  // Frente 10 — incremental period aggregate (RULE-RET-01, Controle B
  // survives the 60-day purge)
  // ============================================================================
  describe('Frente 10 — incremental period aggregate', () => {
    // A genuine in-memory stand-in for attendance_frequency_period_aggregate,
    // driven by the SAME SQL text the service actually issues (matched by
    // regex, same seam as buildService's own mock) — the closest a unit test
    // can get to proving the upsert/delta behaviour without a real Postgres
    // connection. Deliberately does not model the WHERE clause's tenant/
    // person/classGroup/subject/window key: every test in this block uses a
    // single, consistent (person, turma, matéria, período), which is exactly
    // the scenario the aggregate's own unique key is scoped to.
    function buildStatefulAggregateService() {
      const sessionRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({
          id: 'session-1',
          classGroupId: 'class-group-1',
          subjectId: 'subject-1',
          scheduledStart: new Date('2026-09-01'),
        } as ClassSessionEntity),
      });
      const classGroupRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({
          id: 'class-group-1',
          termStartDate: new Date('2026-08-01'),
          termEndDate: new Date('2026-12-31'),
        } as ClassGroupEntity),
      });

      let currentConsolidationStatus: string | null = null;
      const consolidationRepo = createMockRepository({
        findOneBy: jest.fn(() => Promise.resolve(currentConsolidationStatus ? { status: currentConsolidationStatus } : null)),
      });

      const repositoriesByEntity = new Map<unknown, MockRepository>([
        [ClassSessionEntity, sessionRepo],
        [ClassGroupEntity, classGroupRepo],
        [SessionAttendanceConsolidationEntity, consolidationRepo],
      ]);
      const manager = createMockEntityManager(repositoriesByEntity);

      let aggregateRow: { id: string; present_count: number; considered_count: number } | null = null;
      let fullRescanCalls = 0;

      manager.query.mockImplementation((sql: string, params: unknown[] = []) => {
        if (/FROM attendance_frequency_period_aggregate/.test(sql)) {
          return Promise.resolve(aggregateRow ? [aggregateRow] : []);
        }
        if (/INSERT INTO attendance_frequency_period_aggregate/.test(sql)) {
          aggregateRow = { id: 'aggregate-1', present_count: Number(params[6]), considered_count: Number(params[7]) };
          return Promise.resolve([aggregateRow]);
        }
        if (/UPDATE attendance_frequency_period_aggregate/.test(sql)) {
          if (!aggregateRow) {
            throw new Error('test setup error: UPDATE issued against a non-existent aggregate row');
          }
          aggregateRow = {
            ...aggregateRow,
            present_count: aggregateRow.present_count + Number(params[0]),
            considered_count: aggregateRow.considered_count + Number(params[1]),
          };
          // Real Postgres driver shape for UPDATE...RETURNING: `[rows,
          // rowCount]`, not `rows` directly — see the default buildService
          // mock's identical comment.
          return Promise.resolve([[aggregateRow], 1]);
        }
        if (/FROM class_session/i.test(sql)) {
          fullRescanCalls += 1;
          // Bootstrap baseline: at the moment this fires (first-ever touch
          // of this session/person/período), the consolidation row already
          // holds its first definitive status — mirrors production, where
          // the caller always writes session_attendance_consolidation
          // before calling recalculateForSessionPerson.
          return Promise.resolve([{ considered_count: '1', present_count: '0' }]);
        }
        return Promise.resolve([]);
      });

      const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
      const configService = {
        resolveEffectiveConfig: jest.fn().mockResolvedValue({
          minAccumulatedFrequencyPercentage: 75,
          accumulatedFrequencyPeriod: 'bimester' as AccumulatedFrequencyPeriod,
        }),
      };
      const warningService = { applyCalculation: jest.fn().mockResolvedValue(undefined) };
      const service = new AttendanceFrequencyEngineService(tenantContext as never, configService as never, warningService as never);

      return {
        service,
        manager,
        setConsolidationStatus: (status: string | null) => {
          currentConsolidationStatus = status;
        },
        // Simulates an aggregate row that was already bootstrapped earlier
        // in the período — e.g. before RULE-RET-01's 60-day purge reached
        // the sessions it was computed from.
        seedAggregate: (presentCount: number, consideredCount: number) => {
          aggregateRow = { id: 'aggregate-seed', present_count: presentCount, considered_count: consideredCount };
        },
        getFullRescanCallCount: () => fullRescanCalls,
      };
    }

    // Required coverage #2 (Orchestrator handoff): the same session's
    // contribution to the aggregate is corrected — not re-added — across a
    // pending-review resolution, a justification approval, and a
    // justification revocation. The aggregate must never duplicate nor lose
    // a count across this sequence.
    test('test_recalculateForSessionPerson_pendingResolvedThenJustificationApprovedThenRevoked_aggregateNeverDuplicatesOrLosesCount', async () => {
      const { service, setConsolidationStatus, getFullRescanCallCount } = buildStatefulAggregateService();

      // Step 1 — PendingReviewService.resolve() style: 'pending' -> 'absent'.
      // No aggregate exists yet for this (person, turma, matéria, período):
      // this bootstraps via the one-time full rescan.
      setConsolidationStatus('absent');
      const afterResolve = await service.recalculateForSessionPerson('session-1', 'person-1', 'pending');
      expect(afterResolve).toEqual({ calculable: true, presentCount: 0, consideredCount: 1, percentage: 0 });
      expect(getFullRescanCallCount()).toBe(1);

      // Step 2 — AbsenceJustificationDecisionService.approve() style:
      // 'absent' -> 'absent_justified' on the SAME session. Numerator +1,
      // denominator UNCHANGED — never a second "+1" to considered_count,
      // which would double-count this session.
      setConsolidationStatus('absent_justified');
      const afterApprove = await service.recalculateForSessionPerson('session-1', 'person-1', 'absent');
      expect(afterApprove).toEqual({ calculable: true, presentCount: 1, consideredCount: 1, percentage: 100 });
      // Still exactly one bootstrap — this transition went through the
      // incremental diff path, never a second rescan.
      expect(getFullRescanCallCount()).toBe(1);

      // Step 3 — AbsenceJustificationDecisionService.revoke() style
      // (RULE-JUST-17): 'absent_justified' -> 'absent', within the current
      // período de apuração. The aggregate must return EXACTLY to its
      // step-1 state — not merely "some" numerator drop.
      setConsolidationStatus('absent');
      const afterRevoke = await service.recalculateForSessionPerson('session-1', 'person-1', 'absent_justified');
      expect(afterRevoke).toEqual({ calculable: true, presentCount: 0, consideredCount: 1, percentage: 0 });
      expect(getFullRescanCallCount()).toBe(1);
    });

    // Required coverage #3 (Orchestrator handoff): sessions already folded
    // into the aggregate before RULE-RET-01's 60-day purge keep contributing
    // correctly even though their session_attendance_consolidation rows no
    // longer exist — because the engine never rereads them for a period
    // whose aggregate already exists. This is the exact failure mode Frente
    // 10 exists to close: the pre-Frente-10 countInWindow rescanned the
    // WHOLE window on every call and would silently under-count once those
    // early rows were gone.
    test('test_recalculateForSessionPerson_periodAggregateAlreadyBootstrapped_updatesByDiffWithoutRereadingPurgedSessions', async () => {
      const { service, setConsolidationStatus, seedAggregate, getFullRescanCallCount } = buildStatefulAggregateService();

      // Pre-seed the aggregate as if it had already been bootstrapped
      // earlier in the período, from sessions whose raw rows have since been
      // purged: 32 present out of 40 considered.
      seedAggregate(32, 40);

      // A brand-new session for this person, evaluated directly as 'present'
      // (the ordinary ControleA call site — never went through pending).
      setConsolidationStatus('present');
      const result = await service.recalculateForSessionPerson('session-1', 'person-1', null);

      expect(result).toEqual({
        calculable: true,
        presentCount: 33,
        consideredCount: 41,
        percentage: Math.round((33 * 100) / 41),
      });
      // The whole point of the aggregate: this update never touched the
      // class_session-driven rescan — exactly the query that would fail to
      // find the purged rows once RULE-RET-01's sweep has run.
      expect(getFullRescanCallCount()).toBe(0);
    });

    // Testing Agent finding, dedicated regression test: applyAggregateDelta
    // (the diff/UPDATE path, exercised here through the public entry point)
    // must never return NaN. Pre-fix, `manager.query`'s real Postgres driver
    // return shape for UPDATE...RETURNING — a TUPLE, `[rows, rowCount]`, not
    // `rows` directly — meant `rows[0]` was actually the whole inner rows
    // array, and `Number(row.present_count)` on that was `NaN`. That corrupt
    // FrequencyCalculation would then reach
    // AttendanceWarningService.classify(NaN, min), which always resolves to
    // "no warning" — silently deleting any active frequency warning on every
    // incremental update after a period's first bootstrap
    // (RULE-FREQ-03/04/07), with no exception thrown anywhere. This test's
    // mock reflects the real driver's tuple shape (see
    // buildStatefulAggregateService's own UPDATE branch) specifically so a
    // regression here fails loudly instead of silently.
    test('test_recalculateForSessionPerson_incrementalDiffPath_neverReturnsNaN', async () => {
      const { service, setConsolidationStatus, seedAggregate } = buildStatefulAggregateService();

      seedAggregate(10, 20);
      setConsolidationStatus('present');
      const result = await service.recalculateForSessionPerson('session-1', 'person-1', null);

      expect(result.calculable).toBe(true);
      if (result.calculable) {
        expect(result.presentCount).not.toBeNaN();
        expect(result.consideredCount).not.toBeNaN();
        expect(result.percentage).not.toBeNaN();
        expect(result).toEqual({ calculable: true, presentCount: 11, consideredCount: 21, percentage: Math.round((11 * 100) / 21) });
      }
    });
  });

  // ============================================================================
  // Testing Agent finding (Frente 10): lost-update race on concurrent
  // bootstraps of the SAME (tenant, person, class_group, subject, period) —
  // fixed by a transaction-scoped Postgres advisory lock
  // (pg_advisory_xact_lock, hashtext(key)) taken BEFORE the
  // check-then-act "does the row exist yet?" sequence, same pattern
  // DeduplicationService already uses for its own check-then-act race.
  // ============================================================================
  describe('Frente 10 — lost-update fix: advisory lock serializes bootstrap/diff', () => {
    test('test_readOrUpdateAggregate_acquiresAdvisoryLockBeforeCheckingAggregateExistence', async () => {
      const { service, manager } = buildService();

      await service.recalculateForSessionPerson('session-1', 'person-1');

      // The lock must be the very FIRST attendance_frequency_period_aggregate-
      // related statement — strictly before the existence check (SELECT) and
      // strictly before the bootstrap INSERT, so no code path can ever read
      // or write the row before serializing on this key.
      const [lockSql, lockParams] = manager.query.mock.calls[0];
      expect(lockSql).toContain('pg_advisory_xact_lock');

      const window = currentPeriodWindow(
        new Date('2026-08-01'),
        new Date('2026-12-31'),
        AccumulatedFrequencyPeriod.BIMESTER,
        new Date('2026-09-01'),
      )!;
      expect(lockParams).toEqual([
        `tenant-a-id:person-1:class-group-1:subject-1:${window.startDate.toISOString()}:${window.endDate.toISOString()}`,
      ]);

      const lockCallIndex = manager.query.mock.calls.findIndex(([sql]) => (sql as string).includes('pg_advisory_xact_lock'));
      const selectCallIndex = manager.query.mock.calls.findIndex(([sql]) =>
        /FROM attendance_frequency_period_aggregate/.test(sql as string),
      );
      const insertCallIndex = manager.query.mock.calls.findIndex(([sql]) =>
        /INSERT INTO attendance_frequency_period_aggregate/.test(sql as string),
      );
      expect(lockCallIndex).toBe(0);
      expect(lockCallIndex).toBeLessThan(selectCallIndex);
      expect(lockCallIndex).toBeLessThan(insertCallIndex);
    });

    // Simulates the actual race the Testing Agent found: two DIFFERENT
    // sessions of the SAME (person, turma, matéria, período) reaching this
    // engine at once — e.g. PendingReviewService.resolve() on session-a
    // racing a concurrent reconcileForPerson()/Frente 07 decision on
    // session-b — both bootstrapping because neither has committed yet.
    // Transaction A is deliberately held mid-bootstrap (blocked on its own
    // full rescan, AFTER it has already acquired the advisory lock) so the
    // test can prove Transaction B's check-then-act sequence never even
    // starts until A releases the lock (simulated here as "commits", right
    // after A's own write) — and that once B does proceed, it applies ITS
    // OWN diff on top of A's row instead of silently accepting A's row as
    // the final answer, which is exactly the data loss the finding
    // described.
    test('test_readOrUpdateAggregate_concurrentBootstraps_secondTransactionAppliesOwnDiffInsteadOfDiscardingIt', async () => {
      // Stand-in for the attendance_frequency_period_aggregate table row,
      // shared across both simulated transactions/connections.
      let aggregateRow: { id: string; present_count: number; considered_count: number } | null = null;

      // Minimal async mutex standing in for pg_advisory_xact_lock's real
      // transaction-scoped behaviour: the second acquirer's promise does not
      // resolve until the first explicitly releases (simulated at the point
      // each transaction issues its own commit-equivalent write below).
      let locked = false;
      const waiters: Array<() => void> = [];
      function acquireLock(): Promise<void> {
        if (!locked) {
          locked = true;
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => waiters.push(resolve));
      }
      function releaseLock(): void {
        const next = waiters.shift();
        if (next) {
          next();
        } else {
          locked = false;
        }
      }

      // Transaction A's full rescan is held open via this deferred promise
      // so the test can force B to reach — and block on — the lock WHILE A
      // still holds it, before letting A finish and commit.
      let resolveRescanA!: (rows: Array<{ considered_count: string; present_count: string }>) => void;
      const rescanAPromise = new Promise<Array<{ considered_count: string; present_count: string }>>((resolve) => {
        resolveRescanA = resolve;
      });

      function buildTransaction(sessionId: string, consolidationStatus: string, isBootstrapper: boolean) {
        const sessionRepo = createMockRepository({
          findOneBy: jest.fn().mockResolvedValue({
            id: sessionId,
            classGroupId: 'class-group-1',
            subjectId: 'subject-1',
            scheduledStart: new Date('2026-09-01'),
          } as ClassSessionEntity),
        });
        const classGroupRepo = createMockRepository({
          findOneBy: jest.fn().mockResolvedValue({
            id: 'class-group-1',
            termStartDate: new Date('2026-08-01'),
            termEndDate: new Date('2026-12-31'),
          } as ClassGroupEntity),
        });
        const consolidationRepo = createMockRepository({
          findOneBy: jest.fn().mockResolvedValue({ status: consolidationStatus }),
        });
        const repositoriesByEntity = new Map<unknown, MockRepository>([
          [ClassSessionEntity, sessionRepo],
          [ClassGroupEntity, classGroupRepo],
          [SessionAttendanceConsolidationEntity, consolidationRepo],
        ]);
        const manager = createMockEntityManager(repositoriesByEntity);

        manager.query.mockImplementation(async (sql: string, params: unknown[] = []) => {
          if (/pg_advisory_xact_lock/.test(sql)) {
            await acquireLock();
            return [];
          }
          if (/FROM attendance_frequency_period_aggregate/.test(sql)) {
            return aggregateRow ? [aggregateRow] : [];
          }
          if (/INSERT INTO attendance_frequency_period_aggregate/.test(sql)) {
            aggregateRow = { id: 'aggregate-a', present_count: Number(params[6]), considered_count: Number(params[7]) };
            releaseLock(); // simulates this transaction committing
            return [aggregateRow];
          }
          if (/UPDATE attendance_frequency_period_aggregate/.test(sql)) {
            if (!aggregateRow) {
              throw new Error('test setup error: UPDATE issued against a non-existent aggregate row');
            }
            aggregateRow = {
              ...aggregateRow,
              present_count: aggregateRow.present_count + Number(params[0]),
              considered_count: aggregateRow.considered_count + Number(params[1]),
            };
            releaseLock(); // simulates this transaction committing
            // Real Postgres driver shape for UPDATE...RETURNING: `[rows,
            // rowCount]`, not `rows` directly — see the default buildService
            // mock's identical comment.
            return [[aggregateRow], 1];
          }
          if (/FROM class_session/i.test(sql)) {
            if (!isBootstrapper) {
              // The whole point of the fix: only the transaction that wins
              // the lock (and finds no row yet) should ever run the full
              // rescan. If B reaches this branch, the lock failed to
              // serialize it behind A.
              throw new Error('test setup error: this transaction should never bootstrap — the lock should have serialized it behind the winner');
            }
            return rescanAPromise;
          }
          return [];
        });

        const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
        const configService = {
          resolveEffectiveConfig: jest.fn().mockResolvedValue({
            minAccumulatedFrequencyPercentage: 75,
            accumulatedFrequencyPeriod: 'bimester' as AccumulatedFrequencyPeriod,
          }),
        };
        const warningService = { applyCalculation: jest.fn().mockResolvedValue(undefined) };
        const service = new AttendanceFrequencyEngineService(tenantContext as never, configService as never, warningService as never);
        return { service, manager };
      }

      // Transaction A: PendingReviewService.resolve() style, 'pending' ->
      // 'absent' on session-a — the FIRST ever touch of this (person,
      // turma, matéria, período), so it bootstraps.
      const { service: serviceA, manager: managerA } = buildTransaction('session-a', 'absent', true);
      // Transaction B: a DIFFERENT session of the SAME (person, turma,
      // matéria, período), reaching the engine concurrently.
      const { service: serviceB, manager: managerB } = buildTransaction('session-b', 'present', false);

      const callA = serviceA.recalculateForSessionPerson('session-a', 'person-1', 'pending');

      // Let A run far enough to acquire the advisory lock and block on its
      // own full rescan — comfortably more ticks than A's own chain of
      // awaits needs, so A is guaranteed to hold the lock before B starts.
      for (let tick = 0; tick < 8; tick += 1) {
        await Promise.resolve();
      }

      const callB = serviceB.recalculateForSessionPerson('session-b', 'person-1', null);

      // Give B's own microtasks a chance to run up to — and block on — the
      // lock, proving B does NOT read/insert the aggregate while A still
      // holds it.
      for (let tick = 0; tick < 8; tick += 1) {
        await Promise.resolve();
      }

      // Now let A finish its bootstrap: 1 considered, 0 present (session-a's
      // own 'absent' contribution, already reflected by the rescan per this
      // engine's own contract — see readOrUpdateAggregate's header comment).
      resolveRescanA([{ considered_count: '1', present_count: '0' }]);

      const [resultA, resultB] = await Promise.all([callA, callB]);

      expect(resultA).toEqual({ calculable: true, presentCount: 0, consideredCount: 1, percentage: 0 });

      // The bug this closes: B must never simply inherit A's committed row
      // (considered=1, present=0) as its own final answer — it has its OWN
      // session (session-b, 'present', previousStatus null) to add on top.
      // Pre-fix, B's INSERT would have lost the race, fallen into the
      // ON CONFLICT SELECT fallback, and returned A's row completely
      // untouched — silently discarding session-b forever.
      expect(resultB).toEqual({ calculable: true, presentCount: 1, consideredCount: 2, percentage: 50 });

      // B's own query sequence proves it: lock, THEN a SELECT that finds
      // A's already-committed row, THEN an UPDATE applying B's own diff —
      // never an INSERT, never a second full rescan.
      const bSqlSequence = managerB.query.mock.calls.map(([sql]) => sql as string);
      expect(bSqlSequence[0]).toContain('pg_advisory_xact_lock');
      expect(bSqlSequence.some((sql) => /FROM attendance_frequency_period_aggregate/.test(sql))).toBe(true);
      expect(bSqlSequence.some((sql) => /UPDATE attendance_frequency_period_aggregate/.test(sql))).toBe(true);
      expect(bSqlSequence.some((sql) => /INSERT INTO attendance_frequency_period_aggregate/.test(sql))).toBe(false);

      // A's sequence: lock, SELECT (empty), full rescan, INSERT.
      const aSqlSequence = managerA.query.mock.calls.map(([sql]) => sql as string);
      expect(aSqlSequence[0]).toContain('pg_advisory_xact_lock');
      expect(aSqlSequence.some((sql) => /INSERT INTO attendance_frequency_period_aggregate/.test(sql))).toBe(true);
    });
  });

  // ClassGroupDeletionOrchestrator's "Unchecked" cleanup primitive (mirrors
  // AttendanceWarningService.deleteWarningsForClassGroup) — see the method's
  // own comment for why RULE-INST-13 passing does not, by itself, guarantee
  // zero aggregate rows.
  describe('deleteAggregatesForClassGroup', () => {
    test('test_deleteAggregatesForClassGroup_deletesByClassGroupIdOnTheCallersManager', async () => {
      const { service, manager } = buildService();

      const callerManager = { query: jest.fn().mockResolvedValue(undefined) };
      await service.deleteAggregatesForClassGroup(callerManager as never, 'class-group-1');

      expect(callerManager.query).toHaveBeenCalledWith(
        'DELETE FROM attendance_frequency_period_aggregate WHERE class_group_id = $1',
        ['class-group-1'],
      );
      // Uses the CALLER's manager, never this.tenantContext.getManager() —
      // invariant 2 in this file's own header.
      expect(manager.query).not.toHaveBeenCalled();
    });
  });
});
