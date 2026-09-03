import {
  ClassGroupEntity,
  ClassGroupScheduleSlotEntity,
  ClassSessionEntity,
  ClassSessionRequiredFactorEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ScheduleRegenerationService } from './schedule-regeneration.service';

// RULE-INST-04 (third-round update, item #5). SessionGenerationService is
// mocked here — its own branch coverage lives in
// session-generation.service.spec.ts — so this file focuses on what
// ScheduleRegenerationService itself owns: the term/room precondition,
// deleting stale future 'scheduled' sessions (plus their
// class_session_required_factor rows, the documented FK-safety decision),
// and choosing the right regeneration range/dedupe set to hand off.
describe('ScheduleRegenerationService', () => {
  const classGroupWithTermAndRoom = {
    id: 'class-group-1',
    courseId: 'course-1',
    roomId: 'room-1',
    termStartDate: new Date(Date.UTC(2026, 8, 1)),
    termEndDate: new Date(Date.UTC(2026, 8, 30)),
  };
  const mondaySlot = {
    id: 'slot-1',
    classGroupId: 'class-group-1',
    subjectId: 'subject-1',
    dayOfWeek: 1,
    startTime: '13:00:00',
    endTime: '15:00:00',
  };

  function buildService(options: {
    classGroupRepo?: MockRepository;
    sessionRepo?: MockRepository;
    requiredFactorRepo?: MockRepository;
    slotRepo?: MockRepository;
    generateForRange?: jest.Mock;
  } = {}) {
    const classGroupRepo =
      options.classGroupRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(classGroupWithTermAndRoom) });
    const sessionRepo = options.sessionRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue([]) });
    const requiredFactorRepo = options.requiredFactorRepo ?? createMockRepository();
    const slotRepo = options.slotRepo ?? createMockRepository({ findBy: jest.fn().mockResolvedValue([mondaySlot]) });

    const manager = createMockEntityManager(
      new Map([
        [ClassGroupEntity, classGroupRepo],
        [ClassSessionEntity, sessionRepo],
        [ClassSessionRequiredFactorEntity, requiredFactorRepo],
        [ClassGroupScheduleSlotEntity, slotRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const sessionGeneration = {
      generateForRange: options.generateForRange ?? jest.fn().mockResolvedValue({ created: 0, skipped: 0 }),
    };

    const service = new ScheduleRegenerationService(tenantContext as never, sessionGeneration as never);
    return { service, classGroupRepo, sessionRepo, requiredFactorRepo, slotRepo, sessionGeneration };
  }

  test('test_regenerateFutureSessions_classGroupNotFound_returnsNoopResult', async () => {
    const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service, sessionGeneration } = buildService({ classGroupRepo });

    const result = await service.regenerateFutureSessions('missing-class-group', 'coordinator-1');

    expect(result).toEqual({ deleted: 0, created: 0, skipped: 0 });
    expect(sessionGeneration.generateForRange).not.toHaveBeenCalled();
  });

  test.each([
    ['termStartDate', { ...classGroupWithTermAndRoom, termStartDate: null }],
    ['termEndDate', { ...classGroupWithTermAndRoom, termEndDate: null }],
    ['roomId', { ...classGroupWithTermAndRoom, roomId: null }],
  ])('test_regenerateFutureSessions_missing_%s_isASilentNoop', async (_label, classGroup) => {
    const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(classGroup) });
    const { service, sessionRepo, sessionGeneration } = buildService({ classGroupRepo });

    const result = await service.regenerateFutureSessions('class-group-1', 'coordinator-1');

    expect(result).toEqual({ deleted: 0, created: 0, skipped: 0 });
    expect(sessionRepo.find).not.toHaveBeenCalled();
    expect(sessionGeneration.generateForRange).not.toHaveBeenCalled();
  });

  // Past sessions preserved: never even queried by the delete step (status +
  // MoreThan(now) filter, asserted below), and past dates can't produce a
  // future candidate either way.
  test('test_regenerateFutureSessions_pastScheduledSession_isNeverDeleted', async () => {
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
    const { service } = buildService({ sessionRepo });

    await service.regenerateFutureSessions('class-group-1', 'coordinator-1');

    const findCall = sessionRepo.find.mock.calls[0][0];
    expect(findCall.where.classGroupId).toBe('class-group-1');
    expect(findCall.where.status).toBe('scheduled');
    // MoreThan(now) — a FindOperator, asserted structurally.
    expect(findCall.where.scheduledStart.type).toBe('moreThan');
    expect(findCall.where.scheduledStart.value).toBeInstanceOf(Date);
  });

  test('test_regenerateFutureSessions_staleFutureScheduledSessions_deletesRequiredFactorRowsThenSessions', async () => {
    const staleSessions = [
      { id: 'session-1', classGroupId: 'class-group-1', status: 'scheduled' },
      { id: 'session-2', classGroupId: 'class-group-1', status: 'scheduled' },
    ];
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(staleSessions) });
    const { service, requiredFactorRepo } = buildService({ sessionRepo });

    const result = await service.regenerateFutureSessions('class-group-1', 'coordinator-1');

    const requiredFactorDeleteCriteria = requiredFactorRepo.delete.mock.calls[0][0];
    expect(requiredFactorDeleteCriteria.classSessionId.type).toBe('in');
    expect(requiredFactorDeleteCriteria.classSessionId.value).toEqual(['session-1', 'session-2']);
    expect(sessionRepo.delete).toHaveBeenCalledWith(['session-1', 'session-2']);
    expect(result.deleted).toBe(2);
    // required_factor rows deleted strictly before the sessions themselves —
    // otherwise the FK would reject the class_session delete.
    const requiredFactorDeleteOrder = requiredFactorRepo.delete.mock.invocationCallOrder[0];
    const sessionDeleteOrder = sessionRepo.delete.mock.invocationCallOrder[0];
    expect(requiredFactorDeleteOrder).toBeLessThan(sessionDeleteOrder);
  });

  test('test_regenerateFutureSessions_noStaleFutureSessions_doesNotTouchDeleteAtAll', async () => {
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
    const { service, requiredFactorRepo } = buildService({ sessionRepo });

    await service.regenerateFutureSessions('class-group-1', 'coordinator-1');

    expect(sessionRepo.delete).not.toHaveBeenCalled();
    expect(requiredFactorRepo.delete).not.toHaveBeenCalled();
  });

  test('test_regenerateFutureSessions_delegatesToSessionGeneration_withCancelledIncludedInDedupeStatuses', async () => {
    const { service, sessionGeneration } = buildService();

    await service.regenerateFutureSessions('class-group-1', 'coordinator-1');

    expect(sessionGeneration.generateForRange).toHaveBeenCalledWith(
      expect.objectContaining({
        classGroup: classGroupWithTermAndRoom,
        slots: [mondaySlot],
        rangeEndDate: classGroupWithTermAndRoom.termEndDate,
        dedupeStatuses: ['scheduled', 'edited', 'cancelled'],
        strictlyAfter: expect.any(Date),
      }),
    );
  });

  test('test_regenerateFutureSessions_emptySlots_stillDeletesButSkipsGeneration', async () => {
    const staleSessions = [{ id: 'session-1', classGroupId: 'class-group-1', status: 'scheduled' }];
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(staleSessions) });
    const slotRepo = createMockRepository({ findBy: jest.fn().mockResolvedValue([]) });
    const { service, sessionGeneration } = buildService({ sessionRepo, slotRepo });

    const result = await service.regenerateFutureSessions('class-group-1', 'coordinator-1');

    expect(sessionRepo.delete).toHaveBeenCalledWith(['session-1']);
    expect(sessionGeneration.generateForRange).toHaveBeenCalledWith(expect.objectContaining({ slots: [] }));
    expect(result.deleted).toBe(1);
  });

  test('test_regenerateFutureSessions_returnsCombinedDeletedCreatedSkippedCounts', async () => {
    const staleSessions = [{ id: 'session-1', classGroupId: 'class-group-1', status: 'scheduled' }];
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(staleSessions) });
    const generateForRange = jest.fn().mockResolvedValue({ created: 3, skipped: 2 });
    const { service } = buildService({ sessionRepo, generateForRange });

    const result = await service.regenerateFutureSessions('class-group-1', 'coordinator-1');

    expect(result).toEqual({ deleted: 1, created: 3, skipped: 2 });
  });
});
