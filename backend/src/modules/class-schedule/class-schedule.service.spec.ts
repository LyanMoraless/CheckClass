import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClassGroupEntity, ClassGroupScheduleSlotEntity, SubjectEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ClassScheduleService, CreateScheduleSlotInput } from './class-schedule.service';

// RULE-INST-04/07/09/10. LeadershipScopeService is mocked here (its own
// branch coverage lives in leadership-scope.service.spec.ts). The actual
// grade -> class_session projection/conflict-check/create pipeline is fully
// delegated to SessionGenerationService (own spec:
// session-generation.service.spec.ts) and the createSlot/deleteSlot ->
// regeneration wiring is delegated to ScheduleRegenerationService (own spec:
// schedule-regeneration.service.spec.ts) — both mocked here too, so this
// file only covers what ClassScheduleService itself is responsible for:
// authorization, precondition validation, and correctly wiring those calls.
describe('ClassScheduleService', () => {
  const subject = { id: 'subject-1', courseId: 'course-1' };
  const classGroupWithTermAndRoom = {
    id: 'class-group-1',
    subjectId: 'subject-1',
    roomId: 'room-1',
    termStartDate: new Date(Date.UTC(2026, 8, 7)), // Monday 2026-09-07
    termEndDate: new Date(Date.UTC(2026, 8, 13)), // Sunday 2026-09-13 (one week)
  };
  const mondaySlot = { id: 'slot-1', classGroupId: 'class-group-1', dayOfWeek: 1, startTime: '13:00:00', endTime: '15:00:00' };

  function buildService(options: {
    authorized?: boolean;
    classGroupRepo?: MockRepository;
    subjectRepo?: MockRepository;
    slotRepo?: MockRepository;
    generateForRange?: jest.Mock;
    regenerateFutureSessions?: jest.Mock;
  } = {}) {
    const classGroupRepo =
      options.classGroupRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(classGroupWithTermAndRoom) });
    const subjectRepo =
      options.subjectRepo ?? createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(subject) });
    const slotRepo = options.slotRepo ?? createMockRepository({ findBy: jest.fn().mockResolvedValue([mondaySlot]) });

    const manager = createMockEntityManager(
      new Map([
        [ClassGroupEntity, classGroupRepo],
        [SubjectEntity, subjectRepo],
        [ClassGroupScheduleSlotEntity, slotRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const leadershipScope = { hasAuthorityOverClassGroup: jest.fn().mockResolvedValue(options.authorized ?? true) };
    const sessionGeneration = {
      generateForRange: options.generateForRange ?? jest.fn().mockResolvedValue({ created: 1, skipped: 0 }),
    };
    const scheduleRegeneration = {
      regenerateFutureSessions: options.regenerateFutureSessions ?? jest.fn().mockResolvedValue({ deleted: 0, created: 0, skipped: 0 }),
    };

    const service = new ClassScheduleService(
      tenantContext as never,
      leadershipScope as never,
      sessionGeneration as never,
      scheduleRegeneration as never,
    );
    return { service, classGroupRepo, subjectRepo, slotRepo, leadershipScope, sessionGeneration, scheduleRegeneration };
  }

  describe('createSlot', () => {
    const input: CreateScheduleSlotInput = { dayOfWeek: 1, startTime: '13:00', endTime: '15:00' };

    test('test_createSlot_authorizedAndValidTimes_savesSlot', async () => {
      const { service, slotRepo } = buildService();

      await service.createSlot('class-group-1', input, 'coordinator-1');

      expect(slotRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ classGroupId: 'class-group-1', dayOfWeek: 1, startTime: '13:00', endTime: '15:00' }),
      );
    });

    // RULE-INST-04 item #5.
    test('test_createSlot_afterSaving_triggersRegenerateFutureSessions', async () => {
      const { service, scheduleRegeneration } = buildService();

      await service.createSlot('class-group-1', input, 'coordinator-1');

      expect(scheduleRegeneration.regenerateFutureSessions).toHaveBeenCalledWith('class-group-1', 'coordinator-1');
    });

    test('test_createSlot_endTimeNotAfterStartTime_throwsBadRequestWithoutSavingOrRegenerating', async () => {
      const { service, slotRepo, scheduleRegeneration } = buildService();

      await expect(service.createSlot('class-group-1', { ...input, startTime: '15:00', endTime: '15:00' }, 'coordinator-1')).rejects.toThrow(
        BadRequestException,
      );
      expect(slotRepo.save).not.toHaveBeenCalled();
      expect(scheduleRegeneration.regenerateFutureSessions).not.toHaveBeenCalled();
    });

    test('test_createSlot_notAuthorizedOverClassGroup_throwsForbiddenWithoutSaving', async () => {
      const { service, slotRepo } = buildService({ authorized: false });

      await expect(service.createSlot('class-group-1', input, 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(slotRepo.save).not.toHaveBeenCalled();
    });

    test('test_createSlot_classGroupNotFound_throwsNotFound', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ classGroupRepo });

      await expect(service.createSlot('missing-class-group', input, 'coordinator-1')).rejects.toThrow(NotFoundException);
    });
  });

  // RULE-INST-09 scopes the leadership-authority requirement to "montar ou
  // editar", not to reading — listSlots is a plain read, consistent with the
  // sibling read endpoints (ClassGroupController.list/listEnrollments,
  // ClassSessionController.list), none of which check LeadershipScopeService.
  describe('listSlots', () => {
    test('test_listSlots_returnsSlotsOrderedByDayAndStartTime', async () => {
      const slots = [mondaySlot];
      const slotRepo = createMockRepository({ findBy: jest.fn().mockResolvedValue(slots), find: jest.fn().mockResolvedValue(slots) });
      const { service } = buildService({ slotRepo });

      const result = await service.listSlots('class-group-1');

      expect(result).toBe(slots);
      expect(slotRepo.find).toHaveBeenCalledWith({
        where: { classGroupId: 'class-group-1' },
        order: { dayOfWeek: 'ASC', startTime: 'ASC' },
      });
    });

    test('test_listSlots_doesNotCheckLeadershipAuthority', async () => {
      const { service, leadershipScope } = buildService({ authorized: false });

      await expect(service.listSlots('class-group-1')).resolves.toBeDefined();
      expect(leadershipScope.hasAuthorityOverClassGroup).not.toHaveBeenCalled();
    });
  });

  describe('deleteSlot', () => {
    test('test_deleteSlot_slotExists_deletesById', async () => {
      const slotRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(mondaySlot) });
      const { service } = buildService({ slotRepo });

      await service.deleteSlot('class-group-1', 'slot-1', 'coordinator-1');

      expect(slotRepo.delete).toHaveBeenCalledWith({ id: 'slot-1' });
    });

    // RULE-INST-04 item #5.
    test('test_deleteSlot_afterDeleting_triggersRegenerateFutureSessions', async () => {
      const slotRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(mondaySlot) });
      const { service, scheduleRegeneration } = buildService({ slotRepo });

      await service.deleteSlot('class-group-1', 'slot-1', 'coordinator-1');

      expect(scheduleRegeneration.regenerateFutureSessions).toHaveBeenCalledWith('class-group-1', 'coordinator-1');
    });

    test('test_deleteSlot_slotNotFound_throwsNotFoundWithoutDeletingOrRegenerating', async () => {
      const slotRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, scheduleRegeneration } = buildService({ slotRepo });

      await expect(service.deleteSlot('class-group-1', 'missing-slot', 'coordinator-1')).rejects.toThrow(NotFoundException);
      expect(slotRepo.delete).not.toHaveBeenCalled();
      expect(scheduleRegeneration.regenerateFutureSessions).not.toHaveBeenCalled();
    });

    test('test_deleteSlot_notAuthorized_throwsForbiddenBeforeTouchingSlotRepo', async () => {
      const slotRepo = createMockRepository();
      const { service } = buildService({ authorized: false, slotRepo });

      await expect(service.deleteSlot('class-group-1', 'slot-1', 'random-person')).rejects.toThrow(ForbiddenException);
      expect(slotRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('generateSessions', () => {
    test('test_generateSessions_missingTermDates_throwsBadRequestWithoutDelegating', async () => {
      const classGroupRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ ...classGroupWithTermAndRoom, termStartDate: null, termEndDate: null }),
      });
      const { service, sessionGeneration } = buildService({ classGroupRepo });

      await expect(service.generateSessions('class-group-1', 'coordinator-1')).rejects.toThrow(BadRequestException);
      expect(sessionGeneration.generateForRange).not.toHaveBeenCalled();
    });

    test('test_generateSessions_missingRoom_throwsBadRequestWithoutDelegating', async () => {
      const classGroupRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ ...classGroupWithTermAndRoom, roomId: null }),
      });
      const { service, sessionGeneration } = buildService({ classGroupRepo });

      await expect(service.generateSessions('class-group-1', 'coordinator-1')).rejects.toThrow(BadRequestException);
      expect(sessionGeneration.generateForRange).not.toHaveBeenCalled();
    });

    test('test_generateSessions_notAuthorized_throwsForbiddenBeforeAnyOtherQuery', async () => {
      const slotRepo = createMockRepository();
      const { service, sessionGeneration } = buildService({ authorized: false, slotRepo });

      await expect(service.generateSessions('class-group-1', 'random-person')).rejects.toThrow(ForbiddenException);
      expect(slotRepo.findBy).not.toHaveBeenCalled();
      expect(sessionGeneration.generateForRange).not.toHaveBeenCalled();
    });

    test('test_generateSessions_authorizedWithTermAndRoom_delegatesToSessionGenerationWithWholeTermRange', async () => {
      const { service, sessionGeneration } = buildService();

      const result = await service.generateSessions('class-group-1', 'coordinator-1');

      expect(sessionGeneration.generateForRange).toHaveBeenCalledWith({
        classGroup: classGroupWithTermAndRoom,
        slots: [mondaySlot],
        rangeStartDate: classGroupWithTermAndRoom.termStartDate,
        rangeEndDate: classGroupWithTermAndRoom.termEndDate,
        dedupeStatuses: ['scheduled', 'edited'],
        authenticatedPersonId: 'coordinator-1',
      });
      expect(result).toEqual({ created: 1, skipped: 0 });
    });
  });
});
