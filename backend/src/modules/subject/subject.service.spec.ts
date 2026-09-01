import { ClassGroupEntity, CourseEntity, SubjectEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { SubjectService } from './subject.service';

describe('SubjectService', () => {
  function buildService(
    options: {
      course?: CourseEntity | null;
      subject?: SubjectEntity | null;
      subjectRepo?: MockRepository;
      classGroups?: { id: string }[];
      authorized?: boolean;
    } = {},
  ) {
    const courseRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.course ?? null) });
    const subjectRepo =
      options.subjectRepo ??
      createMockRepository({
        findOneBy: jest.fn().mockResolvedValue(options.subject ?? { id: 'subject-1', courseId: 'course-1' }),
      });
    const classGroupRepo: MockRepository = createMockRepository({ find: jest.fn().mockResolvedValue(options.classGroups ?? []) });
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
    const service = new SubjectService(tenantContext as never, leadershipScope as never, deletionOrchestrator as never);
    return { service, subjectRepo, courseRepo, classGroupRepo, leadershipScope, deletionOrchestrator };
  }

  test('test_create_courseExists_savesSubjectWithTenantIdAndGivenFields', async () => {
    const course = { id: 'course-1' } as CourseEntity;
    const { service, subjectRepo } = buildService({ course });

    await service.create({ courseId: 'course-1', name: 'Cálculo I', code: 'CALC1' });

    expect(subjectRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a-id',
        courseId: 'course-1',
        name: 'Cálculo I',
        code: 'CALC1',
      }),
    );
  });

  test('test_create_codeOmitted_savesWithNullCode', async () => {
    const course = { id: 'course-1' } as CourseEntity;
    const { service, subjectRepo } = buildService({ course });

    await service.create({ courseId: 'course-1', name: 'Cálculo I' });

    expect(subjectRepo.save).toHaveBeenCalledWith(expect.objectContaining({ code: null }));
  });

  test('test_create_courseDoesNotExist_throwsNotFoundWithoutSaving', async () => {
    const { service, subjectRepo } = buildService({ course: null });

    await expect(service.create({ courseId: 'missing-course', name: 'Cálculo I' })).rejects.toThrow(
      'course missing-course not found',
    );
    expect(subjectRepo.save).not.toHaveBeenCalled();
  });

  test('test_list_noCourseIdFilter_returnsAllSubjects', async () => {
    const { service, subjectRepo } = buildService({ course: null });

    await service.list();

    expect(subjectRepo.find).toHaveBeenCalled();
    expect(subjectRepo.findBy).not.toHaveBeenCalled();
  });

  test('test_list_withCourseIdFilter_filtersByCourse', async () => {
    const { service, subjectRepo } = buildService({ course: null });

    await service.list('course-1');

    expect(subjectRepo.findBy).toHaveBeenCalledWith({ courseId: 'course-1' });
  });

  // RULE-INST-08/13: cascades to the subject's turmas, tudo-ou-nada blocked
  // via ClassGroupDeletionOrchestrator.assertAllDeletable (its own
  // attendance-activity branch coverage lives in
  // class-group-deletion-orchestrator.service.spec.ts).
  describe('delete', () => {
    test('test_delete_subjectNotFound_throwsNotFound', async () => {
      const subjectRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ subjectRepo });

      await expect(service.delete('missing-subject', 'coordinator-1')).rejects.toThrow(/subject missing-subject not found/);
    });

    test('test_delete_notAuthorizedOverCourse_throwsForbidden_beforeDeletingAnything', async () => {
      const { service, deletionOrchestrator } = buildService({ authorized: false });

      await expect(service.delete('subject-1', 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(deletionOrchestrator.assertAllDeletable).not.toHaveBeenCalled();
    });

    test('test_delete_noClassGroups_deletesSubjectWithoutTouchingOrchestratorDeletion', async () => {
      const { service, subjectRepo, deletionOrchestrator } = buildService({ classGroups: [] });

      await service.delete('subject-1', 'coordinator-1');

      expect(deletionOrchestrator.assertAllDeletable).toHaveBeenCalledWith([]);
      expect(deletionOrchestrator.deleteClassGroupUnchecked).not.toHaveBeenCalled();
      expect(subjectRepo.delete).toHaveBeenCalledWith({ id: 'subject-1' });
    });

    test('test_delete_withClassGroups_validatesAllThenDeletesEachThenSubject', async () => {
      const classGroups = [{ id: 'class-group-1' }, { id: 'class-group-2' }];
      const { service, subjectRepo, deletionOrchestrator } = buildService({ classGroups });

      await service.delete('subject-1', 'coordinator-1');

      expect(deletionOrchestrator.assertAllDeletable).toHaveBeenCalledWith(['class-group-1', 'class-group-2']);
      expect(deletionOrchestrator.deleteClassGroupUnchecked).toHaveBeenCalledTimes(2);
      expect(subjectRepo.delete).toHaveBeenCalledWith({ id: 'subject-1' });
    });

    // Tudo-ou-nada: if assertAllDeletable rejects (a blocked turma somewhere
    // in the subject), nothing is deleted — same precedent as
    // SessionGenerationService's conflict-abort-all.
    test('test_delete_oneClassGroupBlocked_rejectsWithoutDeletingAnything', async () => {
      const classGroups = [{ id: 'class-group-1' }];
      const { service, subjectRepo, deletionOrchestrator } = buildService({ classGroups });
      deletionOrchestrator.assertAllDeletable.mockRejectedValue(new Error('RULE-INST-13 blocked'));

      await expect(service.delete('subject-1', 'coordinator-1')).rejects.toThrow(/RULE-INST-13/);
      expect(deletionOrchestrator.deleteClassGroupUnchecked).not.toHaveBeenCalled();
      expect(subjectRepo.delete).not.toHaveBeenCalled();
    });
  });
});
