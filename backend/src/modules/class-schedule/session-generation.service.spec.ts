import { ConflictException } from '@nestjs/common';
import { ClassGroupEnrollmentEntity, ClassSessionEntity, HolidayEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { GenerateForRangeInput, SessionGenerationService } from './session-generation.service';

// RULE-INST-04/07/09/10. The pure projection/self-overlap logic itself is
// covered by schedule-session-projection.util.spec.ts — this file covers
// SessionGenerationService's own job: loading holidays/teachers/existing
// sessions from the DB, then running the tudo-ou-nada conflict-check +
// create loop. Shared by both ClassScheduleService.generateSessions and
// ScheduleRegenerationService.regenerateFutureSessions.
describe('SessionGenerationService', () => {
  const mondaySlot = {
    id: 'slot-1',
    classGroupId: 'class-group-1',
    subjectId: 'subject-1',
    dayOfWeek: 1,
    startTime: '13:00:00',
    endTime: '15:00:00',
  };
  const oneWeekRange = { rangeStartDate: new Date(Date.UTC(2026, 8, 7)), rangeEndDate: new Date(Date.UTC(2026, 8, 13)) }; // Mon 09-07 .. Sun 09-13

  function buildService(options: {
    holidayRepo?: MockRepository;
    enrollmentRepo?: MockRepository;
    classSessionRepo?: MockRepository;
    assertNoConflict?: jest.Mock;
  } = {}) {
    const holidayRepo = options.holidayRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue([]) });
    const enrollmentRepo =
      options.enrollmentRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue([{ personId: 'teacher-1' }]) });
    const classSessionRepo = options.classSessionRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue([]) });

    const manager = createMockEntityManager(
      new Map([
        [HolidayEntity, holidayRepo],
        [ClassGroupEnrollmentEntity, enrollmentRepo],
        [ClassSessionEntity, classSessionRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const conflictDetection = { assertNoConflict: options.assertNoConflict ?? jest.fn().mockResolvedValue(undefined) };
    const classSessionService = { createSession: jest.fn().mockResolvedValue({ id: 'generated-session' }) };

    const service = new SessionGenerationService(tenantContext as never, conflictDetection as never, classSessionService as never);
    return { service, holidayRepo, enrollmentRepo, classSessionRepo, conflictDetection, classSessionService };
  }

  function baseInput(overrides: Partial<GenerateForRangeInput> = {}): GenerateForRangeInput {
    return {
      classGroup: { id: 'class-group-1', roomId: 'room-1' },
      slots: [mondaySlot],
      dedupeStatuses: ['scheduled', 'edited'],
      authenticatedPersonId: 'coordinator-1',
      ...oneWeekRange,
      ...overrides,
    };
  }

  test('test_generateForRange_noSlots_returnsZeroWithoutTouchingAnyRepoOrConflictCheck', async () => {
    const { service, holidayRepo, conflictDetection, classSessionService } = buildService();

    const result = await service.generateForRange(baseInput({ slots: [] }));

    expect(result).toEqual({ created: 0, skipped: 0 });
    expect(holidayRepo.find).not.toHaveBeenCalled();
    expect(conflictDetection.assertNoConflict).not.toHaveBeenCalled();
    expect(classSessionService.createSession).not.toHaveBeenCalled();
  });

  test('test_generateForRange_oneWeekOneMondaySlot_generatesExactlyOneSession', async () => {
    const { service, conflictDetection, classSessionService } = buildService();

    const result = await service.generateForRange(baseInput());

    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(conflictDetection.assertNoConflict).toHaveBeenCalledWith({
      roomId: 'room-1',
      teacherPersonIds: ['teacher-1'],
      scheduledStart: new Date('2026-09-07T13:00:00.000Z'),
      scheduledEnd: new Date('2026-09-07T15:00:00.000Z'),
    });
    expect(classSessionService.createSession).toHaveBeenCalledWith(
      {
        classGroupId: 'class-group-1',
        subjectId: 'subject-1',
        scheduledStart: new Date('2026-09-07T13:00:00.000Z'),
        scheduledEnd: new Date('2026-09-07T15:00:00.000Z'),
      },
      'coordinator-1',
    );
  });

  test('test_generateForRange_holidayOnSlotDate_skipsThatDateEntirely', async () => {
    const holidayRepo = createMockRepository({ find: jest.fn().mockResolvedValue([{ date: new Date(Date.UTC(2026, 8, 7)) }]) });
    const { service, classSessionService } = buildService({ holidayRepo });

    const result = await service.generateForRange(baseInput({ rangeEndDate: new Date(Date.UTC(2026, 8, 14)) }));

    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(classSessionService.createSession).toHaveBeenCalledTimes(1);
    expect(classSessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledStart: new Date('2026-09-14T13:00:00.000Z') }),
      'coordinator-1',
    );
  });

  test('test_generateForRange_existingSessionWithDedupedStatus_skipsWithoutRecreating', async () => {
    const classSessionRepo = createMockRepository({
      find: jest.fn().mockResolvedValue([
        { classGroupId: 'class-group-1', status: 'scheduled', scheduledStart: new Date('2026-09-07T13:00:00.000Z') },
      ]),
    });
    const { service, classSessionService } = buildService({ classSessionRepo });

    const result = await service.generateForRange(baseInput());

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(classSessionService.createSession).not.toHaveBeenCalled();
  });

  test('test_generateForRange_existingSessionWithStatusNotInDedupeSet_isNotSkipped_stillRegenerates', async () => {
    // Same shape as ClassScheduleService.generateSessions' first-generation
    // choice: 'cancelled' is deliberately excluded from its own dedupeStatuses.
    const classSessionRepo = createMockRepository({
      find: jest.fn().mockResolvedValue([
        { classGroupId: 'class-group-1', status: 'cancelled', scheduledStart: new Date('2026-09-07T13:00:00.000Z') },
      ]),
    });
    const { service, classSessionService } = buildService({ classSessionRepo });

    const result = await service.generateForRange(baseInput({ dedupeStatuses: ['scheduled', 'edited'] }));

    expect(result).toEqual({ created: 1, skipped: 0 });
    expect(classSessionService.createSession).toHaveBeenCalledTimes(1);
  });

  // ScheduleRegenerationService's own dedupeStatuses choice (RULE-INST-04
  // item #5): a cancelled session IS deduped there, unlike above.
  test('test_generateForRange_cancelledIncludedInDedupeStatuses_skipsInsteadOfRecreating', async () => {
    const classSessionRepo = createMockRepository({
      find: jest.fn().mockResolvedValue([
        { classGroupId: 'class-group-1', status: 'cancelled', scheduledStart: new Date('2026-09-07T13:00:00.000Z') },
      ]),
    });
    const { service, classSessionService } = buildService({ classSessionRepo });

    const result = await service.generateForRange(baseInput({ dedupeStatuses: ['scheduled', 'edited', 'cancelled'] }));

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(classSessionService.createSession).not.toHaveBeenCalled();
  });

  test('test_generateForRange_strictlyAfterCutoff_excludesAlreadyPastCandidate', async () => {
    const { service, classSessionService } = buildService();

    const result = await service.generateForRange(baseInput({ strictlyAfter: new Date('2026-09-07T14:00:00.000Z') }));

    expect(result).toEqual({ created: 0, skipped: 1 });
    expect(classSessionService.createSession).not.toHaveBeenCalled();
  });

  test('test_generateForRange_conflictDetected_throwsAndCreatesNoSessionsAtAll', async () => {
    const assertNoConflict = jest.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new ConflictException('conflict'));
    const { service, classSessionService } = buildService({ assertNoConflict });

    await expect(
      service.generateForRange(baseInput({ rangeEndDate: new Date(Date.UTC(2026, 8, 14)) })),
    ).rejects.toThrow(ConflictException);
    expect(classSessionService.createSession).not.toHaveBeenCalled();
  });

  // RULE-INST-14: the whole point of the slot-level matéria — one turma, two
  // weekdays, two different matérias, each session created for its own.
  test('test_generateForRange_slotsOfDifferentSubjects_eachSessionCarriesItsOwnSlotsSubject', async () => {
    const wednesdaySlot = { ...mondaySlot, id: 'slot-2', subjectId: 'subject-2', dayOfWeek: 3 };
    const { service, classSessionService } = buildService();

    const result = await service.generateForRange(baseInput({ slots: [mondaySlot, wednesdaySlot] }));

    expect(result).toEqual({ created: 2, skipped: 0 });
    expect(classSessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'subject-1', scheduledStart: new Date('2026-09-07T13:00:00.000Z') }),
      'coordinator-1',
    );
    expect(classSessionService.createSession).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: 'subject-2', scheduledStart: new Date('2026-09-09T13:00:00.000Z') }),
      'coordinator-1',
    );
  });

  // Two matérias in the same room at the same time is still the same
  // RULE-INST-10 conflict — the matéria was never a conflict criterion.
  test('test_generateForRange_ownSlotsOverlapEachOther_throwsConflictBeforeCheckingPersistedSessions', async () => {
    const overlappingSlots = [
      mondaySlot,
      { id: 'slot-2', classGroupId: 'class-group-1', subjectId: 'subject-2', dayOfWeek: 1, startTime: '14:00:00', endTime: '16:00:00' },
    ];
    const { service, conflictDetection, classSessionService } = buildService();

    await expect(service.generateForRange(baseInput({ slots: overlappingSlots }))).rejects.toThrow(ConflictException);
    expect(conflictDetection.assertNoConflict).not.toHaveBeenCalled();
    expect(classSessionService.createSession).not.toHaveBeenCalled();
  });

  test('test_generateForRange_teacherPersonIds_derivedFromTeacherEnrollmentsOnly', async () => {
    const enrollmentRepo = createMockRepository({ find: jest.fn().mockResolvedValue([{ personId: 'teacher-1' }, { personId: 'teacher-2' }]) });
    const { service, conflictDetection } = buildService({ enrollmentRepo });

    await service.generateForRange(baseInput());

    expect(enrollmentRepo.find).toHaveBeenCalledWith({ where: { classGroupId: 'class-group-1', role: 'teacher' } });
    expect(conflictDetection.assertNoConflict).toHaveBeenCalledWith(expect.objectContaining({ teacherPersonIds: ['teacher-1', 'teacher-2'] }));
  });
});
