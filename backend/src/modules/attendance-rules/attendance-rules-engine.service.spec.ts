import {
  AttendancePendingReviewEntity,
  ClassGroupEnrollmentEntity,
  ClassSessionEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { AttendanceRulesEngineService } from './attendance-rules-engine.service';
import { PresenceIntervalService } from './presence-interval.service';

// Motor de Regras de Presença — RULE-ATT-04 (min attendance %), RULE-ATT-07
// (missing required factor -> pending, never auto-decided), RULE-ATT-08 (sum
// of intervals), RULE-ATT-09 (unmatched exit -> pending, DISTINCT from a
// plain missing factor), RULE-ATT-11 (no duplicate open pending for the same
// reason on re-evaluation).
describe('AttendanceRulesEngineService', () => {
  const pastSession: ClassSessionEntity = {
    id: 'session-1',
    tenantId: 'tenant-a-id',
    classGroupId: 'class-group-1',
    roomId: 'room-1',
    scheduledStart: new Date('2026-08-21T10:00:00.000Z'),
    scheduledEnd: new Date('2026-08-21T12:00:00.000Z'), // 120-minute session
    minAttendancePercentageSnapshot: 75 as never,
    toleranceMinutesSnapshot: 20,
    postToleranceBehaviorSnapshot: 'register_only',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  interface Scenario {
    requiredFactorRows: Array<{ attendance_factor_type_id: string; code: string }>;
    satisfiedRows: Array<{ code: string }>;
    presenceInterval: { closedIntervals: Array<{ entryAt: Date; exitAt: Date }>; hasOpenInterval: boolean };
    existingPendingReview?: { resolvedAt: Date | null } | null;
    existingConsolidation?: { id: string } | null;
  }

  function buildService(scenario: Scenario) {
    const sessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(pastSession) });
    const enrollmentRepo = createMockRepository({
      findBy: jest.fn().mockResolvedValue([{ id: 'enrollment-1', classGroupId: 'class-group-1', personId: 'person-1', role: 'student' }]),
    });
    const pendingReviewRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(scenario.existingPendingReview ?? null),
    });
    const consolidationRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(scenario.existingConsolidation ?? null),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [ClassSessionEntity, sessionRepo],
      [ClassGroupEnrollmentEntity, enrollmentRepo],
      [AttendancePendingReviewEntity, pendingReviewRepo],
      [SessionAttendanceConsolidationEntity, consolidationRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    manager.query.mockImplementation((sql: string) => {
      if (sql.includes('class_session_required_factor')) {
        return Promise.resolve(scenario.requiredFactorRows);
      }
      if (sql.includes('identification_checkin')) {
        return Promise.resolve(scenario.satisfiedRows);
      }
      return Promise.resolve([]);
    });
    const tenantContext = createMockTenantContext(manager);

    const presenceIntervalService = {
      rebuildForPerson: jest.fn().mockResolvedValue(scenario.presenceInterval),
    } as unknown as PresenceIntervalService;

    const service = new AttendanceRulesEngineService(tenantContext as never, presenceIntervalService);
    return { service, sessionRepo, pendingReviewRepo, consolidationRepo, presenceIntervalService };
  }

  test('test_evaluateSession_sessionNotFound_throwsNotFoundException', async () => {
    const { service, sessionRepo } = buildService({
      requiredFactorRows: [],
      satisfiedRows: [],
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
    });
    sessionRepo.findOneBy.mockResolvedValue(null);

    await expect(service.evaluateSession('missing-session')).rejects.toThrow(/not found/);
  });

  test('test_evaluateSession_sessionNotYetEnded_throwsBadRequestException', async () => {
    const { service, sessionRepo } = buildService({
      requiredFactorRows: [],
      satisfiedRows: [],
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
    });
    sessionRepo.findOneBy.mockResolvedValue({ ...pastSession, scheduledEnd: new Date(Date.now() + 60 * 60 * 1000) });

    await expect(service.evaluateSession(pastSession.id)).rejects.toThrow(/has not ended yet/);
  });

  test('test_evaluateSession_missingRequiredFactor_recordsPendingWithMissingFactorReason', async () => {
    // RULE-ATT-07: FACIAL_CHECKIN required but never satisfied.
    const { service, pendingReviewRepo, consolidationRepo } = buildService({
      requiredFactorRows: [{ attendance_factor_type_id: 'factor-facial', code: 'FACIAL_CHECKIN' }],
      satisfiedRows: [],
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
    });

    await service.evaluateSession(pastSession.id);

    expect(pendingReviewRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'missing_factor', personId: 'person-1', classSessionId: pastSession.id }),
    );
    expect(consolidationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }));
  });

  test('test_evaluateSession_roomExitRequiredButIntervalNeverClosed_recordsPendingWithMissingExitReasonNotMissingFactor', async () => {
    // Regression guard: RULE-ATT-09's unmatched-exit case must produce reason
    // 'missing_exit', NEVER the generic 'missing_factor' — even though
    // ROOM_EXIT is technically also absent from satisfiedCodes. A prior bug
    // misclassified this as missing_factor; this test fails if that
    // regresses.
    const { service, pendingReviewRepo } = buildService({
      requiredFactorRows: [
        { attendance_factor_type_id: 'factor-entry', code: 'ROOM_ENTRY' },
        { attendance_factor_type_id: 'factor-exit', code: 'ROOM_EXIT' },
      ],
      satisfiedRows: [{ code: 'ROOM_ENTRY' }],
      presenceInterval: { closedIntervals: [], hasOpenInterval: true },
    });

    await service.evaluateSession(pastSession.id);

    expect(pendingReviewRepo.save).toHaveBeenCalledTimes(1);
    expect(pendingReviewRepo.save).toHaveBeenCalledWith(expect.objectContaining({ reason: 'missing_exit' }));
    expect(pendingReviewRepo.save).not.toHaveBeenCalledWith(expect.objectContaining({ reason: 'missing_factor' }));
  });

  const bothEntryExitRequired = [
    { attendance_factor_type_id: 'factor-entry', code: 'ROOM_ENTRY' },
    { attendance_factor_type_id: 'factor-exit', code: 'ROOM_EXIT' },
  ];
  const bothEntryExitSatisfied = [{ code: 'ROOM_ENTRY' }, { code: 'ROOM_EXIT' }];

  test('test_evaluateSession_percentageExactlyAtThreshold_isPresent', async () => {
    // Session is 120 minutes; threshold is 75% -> exactly 90 minutes present.
    // Both ROOM_ENTRY and ROOM_EXIT required: duration-gated branch only
    // applies when exits are actually trackable end to end (see the
    // roomEntryRequired-without-roomExitRequired test below for why).
    const { service, consolidationRepo } = buildService({
      requiredFactorRows: bothEntryExitRequired,
      satisfiedRows: bothEntryExitSatisfied,
      presenceInterval: {
        closedIntervals: [{ entryAt: new Date('2026-08-21T10:00:00.000Z'), exitAt: new Date('2026-08-21T11:30:00.000Z') }],
        hasOpenInterval: false,
      },
    });

    await service.evaluateSession(pastSession.id);

    expect(consolidationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'present', attendancePercentage: 75 }));
  });

  test('test_evaluateSession_percentageJustBelowThreshold_isAbsent', async () => {
    // 89 minutes out of 120 is just under 75% (74.16%).
    const { service, consolidationRepo } = buildService({
      requiredFactorRows: bothEntryExitRequired,
      satisfiedRows: bothEntryExitSatisfied,
      presenceInterval: {
        closedIntervals: [{ entryAt: new Date('2026-08-21T10:00:00.000Z'), exitAt: new Date('2026-08-21T11:29:00.000Z') }],
        hasOpenInterval: false,
      },
    });

    await service.evaluateSession(pastSession.id);

    expect(consolidationRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'absent' }));
  });

  test('test_evaluateSession_multipleClosedIntervals_sumsMinutesForPercentage', async () => {
    // RULE-ATT-08: two separate entry/exit pairs (60 + 30 = 90 of 120 min = 75%).
    const { service, consolidationRepo } = buildService({
      requiredFactorRows: bothEntryExitRequired,
      satisfiedRows: bothEntryExitSatisfied,
      presenceInterval: {
        closedIntervals: [
          { entryAt: new Date('2026-08-21T10:00:00.000Z'), exitAt: new Date('2026-08-21T11:00:00.000Z') },
          { entryAt: new Date('2026-08-21T11:15:00.000Z'), exitAt: new Date('2026-08-21T11:45:00.000Z') },
        ],
        hasOpenInterval: false,
      },
    });

    await service.evaluateSession(pastSession.id);

    expect(consolidationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'present', totalPresenceMinutes: 90, attendancePercentage: 75 }),
    );
  });

  test('test_evaluateSession_roomEntryNotRequired_noPermanenciaTracked_presentWithFullPercentage', async () => {
    // Institution's config doesn't require ROOM_ENTRY at all: no duration
    // signal to gate on, so satisfying the required factors is enough.
    const { service, consolidationRepo } = buildService({
      requiredFactorRows: [{ attendance_factor_type_id: 'factor-tag', code: 'TAG_CHECKIN' }],
      satisfiedRows: [{ code: 'TAG_CHECKIN' }],
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
    });

    await service.evaluateSession(pastSession.id);

    expect(consolidationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'present', totalPresenceMinutes: 0, attendancePercentage: 100 }),
    );
  });

  test('test_evaluateSession_roomEntryRequiredButRoomExitNotRequired_presentWithoutPermanenciaGate', async () => {
    // Regression guard: a real bug had this gated on roomEntryRequired ALONE.
    // A student genuinely present the whole session never generates an exit
    // (it isn't required/tracked for this config), so their interval never
    // closes and totalMinutes stays 0 — the old code computed 0% and marked
    // them absent despite satisfying every required factor. The duration
    // branch must only apply when BOTH entry and exit are required.
    const { service, consolidationRepo } = buildService({
      requiredFactorRows: [{ attendance_factor_type_id: 'factor-entry', code: 'ROOM_ENTRY' }],
      satisfiedRows: [{ code: 'ROOM_ENTRY' }],
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
    });

    await service.evaluateSession(pastSession.id);

    expect(consolidationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'present', attendancePercentage: 100 }),
    );
  });

  test('test_evaluateSession_consolidationAlreadyResolvedByHuman_skipsReEvaluationEntirely', async () => {
    // Critical regression guard: architecture-overview.md is explicit that
    // manual resolution flows back to Consolidation as a human decision
    // "nunca gerada pelo motor". A prior bug had the engine unconditionally
    // overwrite an already-resolved consolidation row (e.g. on a retry or a
    // second session:evaluate run) back to a machine-computed status.
    const { service, consolidationRepo, pendingReviewRepo } = buildService({
      requiredFactorRows: [{ attendance_factor_type_id: 'factor-facial', code: 'FACIAL_CHECKIN' }],
      satisfiedRows: [], // still missing — would normally re-trigger pending
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
      existingConsolidation: {
        id: 'existing-consolidation-id',
        resolvedByPersonId: 'professor-1',
      } as never,
    });

    await service.evaluateSession(pastSession.id);

    expect(consolidationRepo.update).not.toHaveBeenCalled();
    expect(consolidationRepo.save).not.toHaveBeenCalled();
    expect(pendingReviewRepo.save).not.toHaveBeenCalled();
  });

  test('test_evaluateSession_existingUnresolvedPendingForSameReason_doesNotCreateDuplicateReview', async () => {
    // RULE-ATT-11: re-evaluating a session (e.g. a retry) must not spawn a
    // second open pending review for the same person/session/reason.
    const { service, pendingReviewRepo } = buildService({
      requiredFactorRows: [{ attendance_factor_type_id: 'factor-facial', code: 'FACIAL_CHECKIN' }],
      satisfiedRows: [],
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
      existingPendingReview: { resolvedAt: null },
    });

    await service.evaluateSession(pastSession.id);

    expect(pendingReviewRepo.save).not.toHaveBeenCalled();
  });

  test('test_evaluateSession_existingConsolidationRow_isUpdatedNotDuplicated', async () => {
    const { service, consolidationRepo } = buildService({
      requiredFactorRows: [{ attendance_factor_type_id: 'factor-tag', code: 'TAG_CHECKIN' }],
      satisfiedRows: [{ code: 'TAG_CHECKIN' }],
      presenceInterval: { closedIntervals: [], hasOpenInterval: false },
      existingConsolidation: { id: 'existing-consolidation-id' },
    });

    await service.evaluateSession(pastSession.id);

    expect(consolidationRepo.update).toHaveBeenCalledWith(
      { id: 'existing-consolidation-id' },
      expect.objectContaining({ status: 'present' }),
    );
    expect(consolidationRepo.save).not.toHaveBeenCalled();
  });
});
