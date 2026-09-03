import { ClassGroupSubjectEntity, CourseEntity, SubjectEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { SubjectService } from './subject.service';

describe('SubjectService', () => {
  function buildService(
    options: {
      course?: CourseEntity | null;
      subject?: SubjectEntity | null;
      subjectRepo?: MockRepository;
      linkedClassGroupIds?: string[];
      authorized?: boolean;
    } = {},
  ) {
    const courseRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.course ?? null) });
    const subjectRepo =
      options.subjectRepo ??
      createMockRepository({
        findOneBy: jest.fn().mockResolvedValue(options.subject ?? { id: 'subject-1', courseId: 'course-1' }),
      });
    const classGroupSubjectRepo: MockRepository = createMockRepository({
      find: jest
        .fn()
        .mockResolvedValue((options.linkedClassGroupIds ?? []).map((classGroupId) => ({ classGroupId }))),
    });
    const manager = createMockEntityManager(
      new Map([
        [CourseEntity, courseRepo],
        [SubjectEntity, subjectRepo],
        [ClassGroupSubjectEntity, classGroupSubjectRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const leadershipScope = { hasAuthorityOverCourse: jest.fn().mockResolvedValue(options.authorized ?? true) };
    const deletionOrchestrator = {
      assertSubjectRemovable: jest.fn().mockResolvedValue(undefined),
      removeSubjectFromClassGroup: jest.fn().mockResolvedValue(undefined),
    };
    const service = new SubjectService(tenantContext as never, leadershipScope as never, deletionOrchestrator as never);
    return { service, subjectRepo, courseRepo, classGroupSubjectRepo, leadershipScope, deletionOrchestrator };
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
      expect(deletionOrchestrator.assertSubjectRemovable).not.toHaveBeenCalled();
    });

    test('test_delete_noClassGroupUsesIt_deletesSubjectWithoutTouchingAnyTurma', async () => {
      const { service, subjectRepo, deletionOrchestrator } = buildService({ linkedClassGroupIds: [] });

      await service.delete('subject-1', 'coordinator-1');

      expect(deletionOrchestrator.assertSubjectRemovable).not.toHaveBeenCalled();
      expect(deletionOrchestrator.removeSubjectFromClassGroup).not.toHaveBeenCalled();
      expect(subjectRepo.delete).toHaveBeenCalledWith({ id: 'subject-1' });
    });

    // RULE-INST-08 addendum (2026-09-03): the turmas are NOT deleted anymore —
    // only this matéria's own footprint is removed from each of them, and the
    // turmas survive (empty, if this was their only matéria).
    test('test_delete_withLinkedClassGroups_unlinksFromEachThenDeletesSubject_neverDeletingATurma', async () => {
      const { service, subjectRepo, deletionOrchestrator } = buildService({
        linkedClassGroupIds: ['class-group-1', 'class-group-2'],
      });

      await service.delete('subject-1', 'coordinator-1');

      expect(deletionOrchestrator.assertSubjectRemovable).toHaveBeenCalledWith('class-group-1', 'subject-1');
      expect(deletionOrchestrator.assertSubjectRemovable).toHaveBeenCalledWith('class-group-2', 'subject-1');
      expect(deletionOrchestrator.removeSubjectFromClassGroup).toHaveBeenCalledTimes(2);
      expect(subjectRepo.delete).toHaveBeenCalledWith({ id: 'subject-1' });
    });

    // Tudo-ou-nada: every turma is validated before ANY of them is touched, so
    // one blocked turma leaves the whole operation with nothing changed —
    // same precedent as SessionGenerationService's conflict-abort-all.
    test('test_delete_oneClassGroupBlocked_rejectsWithoutUnlinkingOrDeletingAnything', async () => {
      const { service, subjectRepo, deletionOrchestrator } = buildService({
        linkedClassGroupIds: ['class-group-1', 'class-group-2'],
      });
      deletionOrchestrator.assertSubjectRemovable.mockRejectedValue(new Error('RULE-INST-13 blocked'));

      await expect(service.delete('subject-1', 'coordinator-1')).rejects.toThrow(/RULE-INST-13/);
      expect(deletionOrchestrator.removeSubjectFromClassGroup).not.toHaveBeenCalled();
      expect(subjectRepo.delete).not.toHaveBeenCalled();
    });
  });
});
