import {
  AttendancePendingReviewEntity,
  ClassGroupEnrollmentEntity,
  ClassGroupEntity,
  ClassGroupScheduleSlotEntity,
  ClassGroupSubjectEntity,
  ClassSessionEntity,
  ClassSessionRequiredFactorEntity,
  IdentificationCheckinEntity,
  PresenceIntervalEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { ClassGroupDeletionOrchestrator } from './class-group-deletion-orchestrator.service';

// RULE-INST-13: block conditions are read broadly on purpose (consolidation,
// unresolved-or-resolved pending review, raw checkins, presence intervals —
// not just the literal "presença consolidada" text) to protect real
// attendance activity from a hard, unrecoverable delete. See the top-of-file
// comment on class-group-deletion-orchestrator.service.ts for the reasoning.
describe('ClassGroupDeletionOrchestrator', () => {
  const sessions = [{ id: 'session-1' }, { id: 'session-2' }];

  function buildOrchestrator(options: {
    sessionRepo?: MockRepository;
    consolidationRepo?: MockRepository;
    pendingReviewRepo?: MockRepository;
    checkinRepo?: MockRepository;
    presenceIntervalRepo?: MockRepository;
  } = {}) {
    const sessionRepo = options.sessionRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue(sessions) });
    const consolidationRepo = options.consolidationRepo ?? createMockRepository({ count: jest.fn().mockResolvedValue(0) });
    const pendingReviewRepo = options.pendingReviewRepo ?? createMockRepository({ count: jest.fn().mockResolvedValue(0) });
    const checkinRepo = options.checkinRepo ?? createMockRepository({ count: jest.fn().mockResolvedValue(0) });
    const presenceIntervalRepo = options.presenceIntervalRepo ?? createMockRepository({ count: jest.fn().mockResolvedValue(0) });
    const requiredFactorRepo = createMockRepository();
    const classGroupRepo = createMockRepository();
    const scheduleSlotRepo = createMockRepository();
    const enrollmentRepo = createMockRepository();
    const classGroupSubjectRepo = createMockRepository();

    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([
        [ClassSessionEntity, sessionRepo],
        [SessionAttendanceConsolidationEntity, consolidationRepo],
        [AttendancePendingReviewEntity, pendingReviewRepo],
        [IdentificationCheckinEntity, checkinRepo],
        [PresenceIntervalEntity, presenceIntervalRepo],
        [ClassSessionRequiredFactorEntity, requiredFactorRepo],
        [ClassGroupEntity, classGroupRepo],
        [ClassGroupScheduleSlotEntity, scheduleSlotRepo],
        [ClassGroupEnrollmentEntity, enrollmentRepo],
        [ClassGroupSubjectEntity, classGroupSubjectRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    // Controle B's warning cleanup (Frente 06) is a collaborator seam here —
    // this suite is about RULE-INST-13's block conditions, not about what a
    // warning row ends up looking like.
    const warningService = {
      closeWarningsForClassGroupSubject: jest.fn().mockResolvedValue(undefined),
      deleteWarningsForClassGroup: jest.fn().mockResolvedValue(undefined),
    };
    const orchestrator = new ClassGroupDeletionOrchestrator(tenantContext as never, warningService as never);
    return {
      orchestrator,
      manager,
      warningService,
      sessionRepo,
      consolidationRepo,
      pendingReviewRepo,
      checkinRepo,
      presenceIntervalRepo,
      requiredFactorRepo,
      classGroupRepo,
      scheduleSlotRepo,
      enrollmentRepo,
      classGroupSubjectRepo,
    };
  }

  describe('assertDeletable', () => {
    test('test_assertDeletable_noSessions_resolvesWithoutError', async () => {
      const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { orchestrator } = buildOrchestrator({ sessionRepo });

      await expect(orchestrator.assertDeletable('class-group-1')).resolves.toBeUndefined();
    });

    test('test_assertDeletable_noAttendanceActivity_resolvesWithoutError', async () => {
      const { orchestrator } = buildOrchestrator();

      await expect(orchestrator.assertDeletable('class-group-1')).resolves.toBeUndefined();
    });

    test('test_assertDeletable_hasConsolidatedAttendance_throwsConflict', async () => {
      const consolidationRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { orchestrator } = buildOrchestrator({ consolidationRepo });

      await expect(orchestrator.assertDeletable('class-group-1')).rejects.toThrow(/RULE-INST-13/);
    });

    test('test_assertDeletable_hasPendingReview_throwsConflict', async () => {
      const pendingReviewRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { orchestrator } = buildOrchestrator({ pendingReviewRepo });

      await expect(orchestrator.assertDeletable('class-group-1')).rejects.toThrow(/RULE-INST-13/);
    });

    test('test_assertDeletable_hasIdentificationCheckin_throwsConflict', async () => {
      const checkinRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { orchestrator } = buildOrchestrator({ checkinRepo });

      await expect(orchestrator.assertDeletable('class-group-1')).rejects.toThrow(/RULE-INST-13/);
    });

    test('test_assertDeletable_hasPresenceInterval_throwsConflict', async () => {
      const presenceIntervalRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { orchestrator } = buildOrchestrator({ presenceIntervalRepo });

      await expect(orchestrator.assertDeletable('class-group-1')).rejects.toThrow(/RULE-INST-13/);
    });
  });

  describe('assertAllDeletable', () => {
    test('test_assertAllDeletable_allDeletable_resolvesWithoutError', async () => {
      const { orchestrator } = buildOrchestrator();

      await expect(orchestrator.assertAllDeletable(['class-group-1', 'class-group-2'])).resolves.toBeUndefined();
    });

    // Tudo-ou-nada: a single blocked turma anywhere in the batch fails the
    // whole check, same pattern already used by
    // SessionGenerationService/ScheduleRegenerationService's conflict checks.
    test('test_assertAllDeletable_oneBlockedAmongMany_throwsConflict', async () => {
      const consolidationRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { orchestrator } = buildOrchestrator({ consolidationRepo });

      await expect(orchestrator.assertAllDeletable(['class-group-1', 'class-group-2'])).rejects.toThrow(/RULE-INST-13/);
    });
  });

  describe('deleteClassGroup', () => {
    test('test_deleteClassGroup_deletable_deletesSessionsSlotsEnrollmentsAndClassGroup', async () => {
      const { orchestrator, requiredFactorRepo, sessionRepo: classSessionRepo, scheduleSlotRepo, enrollmentRepo, classGroupRepo } =
        buildOrchestrator();

      await orchestrator.deleteClassGroup('class-group-1');

      expect(requiredFactorRepo.delete).toHaveBeenCalled();
      expect(classSessionRepo.delete).toHaveBeenCalled();
      expect(scheduleSlotRepo.delete).toHaveBeenCalledWith({ classGroupId: 'class-group-1' });
      expect(enrollmentRepo.delete).toHaveBeenCalledWith({ classGroupId: 'class-group-1' });
      expect(classGroupRepo.delete).toHaveBeenCalledWith({ id: 'class-group-1' });
    });

    // RULE-INST-14: the turma's matéria links are scoped to the turma and go
    // with it — leaving them behind would strand rows pointing at a
    // class_group that no longer exists.
    test('test_deleteClassGroup_alsoDeletesTheTurmasSubjectLinks', async () => {
      const { orchestrator, classGroupSubjectRepo } = buildOrchestrator();

      await orchestrator.deleteClassGroup('class-group-1');

      expect(classGroupSubjectRepo.delete).toHaveBeenCalledWith({ classGroupId: 'class-group-1' });
    });

    test('test_deleteClassGroup_hasAttendanceActivity_throwsConflict_deletesNothing', async () => {
      const consolidationRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { orchestrator, classGroupRepo, enrollmentRepo } = buildOrchestrator({ consolidationRepo });

      await expect(orchestrator.deleteClassGroup('class-group-1')).rejects.toThrow(/RULE-INST-13/);
      expect(classGroupRepo.delete).not.toHaveBeenCalled();
      expect(enrollmentRepo.delete).not.toHaveBeenCalled();
    });

    test('test_deleteClassGroup_noSessions_skipsSessionAndRequiredFactorDeletes', async () => {
      const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { orchestrator, requiredFactorRepo, classGroupRepo } = buildOrchestrator({ sessionRepo });

      await orchestrator.deleteClassGroup('class-group-1');

      expect(requiredFactorRepo.delete).not.toHaveBeenCalled();
      expect(classGroupRepo.delete).toHaveBeenCalledWith({ id: 'class-group-1' });
    });
  });

  // RULE-INST-14 + RULE-INST-08 addendum: unlinking ONE matéria from a turma
  // — the narrow sibling of a full turma deletion.
  describe('assertSubjectRemovable / removeSubjectFromClassGroup', () => {
    test('test_assertSubjectRemovable_scopesTheActivityCheckToThatSubjectsSessionsOnly', async () => {
      const { orchestrator, sessionRepo } = buildOrchestrator();

      await orchestrator.assertSubjectRemovable('class-group-1', 'subject-1');

      expect(sessionRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { classGroupId: 'class-group-1', subjectId: 'subject-1' } }),
      );
    });

    test('test_assertSubjectRemovable_thatSubjectsSessionsHaveAttendanceActivity_throwsConflict', async () => {
      const consolidationRepo = createMockRepository({ count: jest.fn().mockResolvedValue(1) });
      const { orchestrator } = buildOrchestrator({ consolidationRepo });

      await expect(orchestrator.assertSubjectRemovable('class-group-1', 'subject-1')).rejects.toThrow(/RULE-INST-13/);
    });

    test('test_assertSubjectRemovable_noSessionsForThatSubject_resolves', async () => {
      const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { orchestrator } = buildOrchestrator({ sessionRepo });

      await expect(orchestrator.assertSubjectRemovable('class-group-1', 'subject-1')).resolves.toBeUndefined();
    });

    // The turma itself, its enrollments and its other matérias survive — this
    // is exactly what separates unlinking a matéria from deleting the turma.
    test('test_removeSubjectFromClassGroup_deletesOnlyThatSubjectsSlotsSessionsAndLink', async () => {
      const { orchestrator, manager, requiredFactorRepo, sessionRepo, scheduleSlotRepo, classGroupSubjectRepo, enrollmentRepo, classGroupRepo } =
        buildOrchestrator();

      await orchestrator.removeSubjectFromClassGroup(manager as never, 'class-group-1', 'subject-1');

      expect(requiredFactorRepo.delete).toHaveBeenCalled();
      expect(sessionRepo.delete).toHaveBeenCalled();
      expect(scheduleSlotRepo.delete).toHaveBeenCalledWith({ classGroupId: 'class-group-1', subjectId: 'subject-1' });
      expect(classGroupSubjectRepo.delete).toHaveBeenCalledWith({
        classGroupId: 'class-group-1',
        subjectId: 'subject-1',
      });
      expect(enrollmentRepo.delete).not.toHaveBeenCalled();
      expect(classGroupRepo.delete).not.toHaveBeenCalled();
    });

    // RULE-INST-08 addendum, user-confirmed 2026-09-03: removing the LAST
    // matéria is not special-cased anywhere — the turma is simply left with
    // zero links, never deleted.
    test('test_removeSubjectFromClassGroup_lastSubject_neverDeletesTheTurma', async () => {
      const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { orchestrator, manager, classGroupRepo, enrollmentRepo } = buildOrchestrator({ sessionRepo });

      await orchestrator.removeSubjectFromClassGroup(manager as never, 'class-group-1', 'subject-1');

      expect(classGroupRepo.delete).not.toHaveBeenCalled();
      expect(enrollmentRepo.delete).not.toHaveBeenCalled();
    });
  });
});
