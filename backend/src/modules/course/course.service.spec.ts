import { ClassGroupEntity, CourseEntity, SubjectEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { CourseService } from './course.service';

describe('CourseService', () => {
  function buildService(
    options: {
      course?: CourseEntity | null;
      courseRepo?: MockRepository;
      subjects?: { id: string }[];
      classGroups?: { id: string }[];
      authorized?: boolean;
    } = {},
  ) {
    const courseRepo =
      options.courseRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.course ?? { id: 'course-1' }) });
    const subjectRepo = createMockRepository({ find: jest.fn().mockResolvedValue(options.subjects ?? []) });
    const classGroupRepo = createMockRepository({ find: jest.fn().mockResolvedValue(options.classGroups ?? []) });

    const manager = createMockEntityManager(
      new Map([
        [CourseEntity, courseRepo],
        [SubjectEntity, subjectRepo],
        [ClassGroupEntity, classGroupRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const leadershipScope = { hasAuthorityOverCourse: jest.fn().mockResolvedValue(options.authorized ?? true) };
    const deletionOrchestrator = {
      assertAllDeletable: jest.fn().mockResolvedValue(undefined),
      deleteClassGroupUnchecked: jest.fn().mockResolvedValue(undefined),
    };
    const service = new CourseService(tenantContext as never, leadershipScope as never, deletionOrchestrator as never);
    return { service, courseRepo, subjectRepo, classGroupRepo, leadershipScope, deletionOrchestrator };
  }

  test('test_create_savesCourseWithTenantIdAndGivenFields', async () => {
    const { service, courseRepo } = buildService();

    await service.create({ name: 'Engenharia', code: 'ENG' });

    expect(courseRepo.save).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-a-id', name: 'Engenharia', code: 'ENG' }));
  });

  test('test_list_returnsAllCourses', async () => {
    const { service, courseRepo } = buildService();

    await service.list();

    expect(courseRepo.find).toHaveBeenCalled();
  });

  // RULE-INST-08/13: cascades to the course's subjects and, through them,
  // their turmas, tudo-ou-nada blocked via
  // ClassGroupDeletionOrchestrator.assertAllDeletable (its own
  // attendance-activity branch coverage lives in
  // class-group-deletion-orchestrator.service.spec.ts).
  describe('delete', () => {
    test('test_delete_courseNotFound_throwsNotFound', async () => {
      const courseRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ courseRepo });

      await expect(service.delete('missing-course', 'coordinator-1')).rejects.toThrow(/course missing-course not found/);
    });

    test('test_delete_notAuthorizedOverCourse_throwsForbidden_beforeDeletingAnything', async () => {
      const { service, deletionOrchestrator } = buildService({ authorized: false });

      await expect(service.delete('course-1', 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(deletionOrchestrator.assertAllDeletable).not.toHaveBeenCalled();
    });

    test('test_delete_noSubjects_deletesCourseWithoutTouchingClassGroupDeletion', async () => {
      const { service, courseRepo, deletionOrchestrator } = buildService({ subjects: [] });

      await service.delete('course-1', 'coordinator-1');

      expect(deletionOrchestrator.assertAllDeletable).toHaveBeenCalledWith([]);
      expect(deletionOrchestrator.deleteClassGroupUnchecked).not.toHaveBeenCalled();
      expect(courseRepo.delete).toHaveBeenCalledWith({ id: 'course-1' });
    });

    test('test_delete_withSubjectsAndClassGroups_validatesAllThenCascadesThenDeletesCourse', async () => {
      const subjects = [{ id: 'subject-1' }, { id: 'subject-2' }];
      const classGroups = [{ id: 'class-group-1' }, { id: 'class-group-2' }];
      const { service, courseRepo, subjectRepo, deletionOrchestrator } = buildService({ subjects, classGroups });

      await service.delete('course-1', 'coordinator-1');

      expect(deletionOrchestrator.assertAllDeletable).toHaveBeenCalledWith(['class-group-1', 'class-group-2']);
      expect(deletionOrchestrator.deleteClassGroupUnchecked).toHaveBeenCalledTimes(2);
      expect(subjectRepo.delete).toHaveBeenCalledWith({ id: expect.anything() });
      expect(courseRepo.delete).toHaveBeenCalledWith({ id: 'course-1' });
    });

    // Tudo-ou-nada: if assertAllDeletable rejects (a blocked turma anywhere
    // under this course), nothing is deleted.
    test('test_delete_oneClassGroupBlocked_rejectsWithoutDeletingAnything', async () => {
      const subjects = [{ id: 'subject-1' }];
      const classGroups = [{ id: 'class-group-1' }];
      const { service, courseRepo, subjectRepo, deletionOrchestrator } = buildService({ subjects, classGroups });
      deletionOrchestrator.assertAllDeletable.mockRejectedValue(new Error('RULE-INST-13 blocked'));

      await expect(service.delete('course-1', 'coordinator-1')).rejects.toThrow(/RULE-INST-13/);
      expect(deletionOrchestrator.deleteClassGroupUnchecked).not.toHaveBeenCalled();
      expect(subjectRepo.delete).not.toHaveBeenCalled();
      expect(courseRepo.delete).not.toHaveBeenCalled();
    });
  });
});
