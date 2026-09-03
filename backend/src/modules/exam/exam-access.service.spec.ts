import { ClassGroupEntity, ExamEntity, SubjectEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ExamAccessService } from './exam-access.service';

// RULE-EXAM-16 + Security control 2: management/audit authorization is
// LeadershipScopeService's decision (mocked here — its own branches are
// covered by leadership-scope.service.spec.ts), and the RLS management scope
// must only be opened AFTER that decision came back positive.
describe('ExamAccessService', () => {
  function buildService(options: { authorized?: boolean; exam?: ExamEntity | null; classGroup?: unknown } = {}) {
    const classGroupRepo: MockRepository = createMockRepository({
      findOneBy: jest
        .fn()
        .mockResolvedValue(options.classGroup === undefined ? { id: 'class-group-1', subjectId: 'subject-1' } : options.classGroup),
    });
    const subjectRepo: MockRepository = createMockRepository({
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'subject-1', courseId: 'course-1' }),
    });
    const examRepo: MockRepository = createMockRepository({
      findOneBy: jest
        .fn()
        .mockResolvedValue(
          options.exam === undefined ? ({ id: 'exam-1', classGroupId: 'class-group-1' } as ExamEntity) : options.exam,
        ),
    });

    const manager = createMockEntityManager(
      new Map([
        [ClassGroupEntity, classGroupRepo],
        [SubjectEntity, subjectRepo],
        [ExamEntity, examRepo],
      ]),
    );

    const leadershipScope = {
      hasAuthorityOverClassGroup: jest.fn().mockResolvedValue(options.authorized ?? true),
    };
    const examRlsContext = { applyManagementScope: jest.fn().mockResolvedValue(undefined) };
    const service = new ExamAccessService(
      createMockTenantContext(manager) as never,
      leadershipScope as never,
      examRlsContext as never,
    );

    return { service, leadershipScope, examRlsContext };
  }

  // RULE-INST-03: the course is resolved one hop up through the turma's
  // subject, the same way every other leadership-scoped read does it.
  test('test_authorizeClassGroup_authorized_opensManagementScope', async () => {
    const { service, leadershipScope, examRlsContext } = buildService({ authorized: true });

    await service.authorizeClassGroup('teacher-1', 'class-group-1');

    expect(leadershipScope.hasAuthorityOverClassGroup).toHaveBeenCalledWith('teacher-1', 'course-1', 'class-group-1');
    expect(examRlsContext.applyManagementScope).toHaveBeenCalled();
  });

  // The GUC is a marker that authorization happened — if it is set before or
  // without the check, the fail-closed RLS policies stop meaning anything.
  test('test_authorizeClassGroup_notAuthorized_neverOpensManagementScope', async () => {
    const { service, examRlsContext } = buildService({ authorized: false });

    await expect(service.authorizeClassGroup('stranger-1', 'class-group-1')).rejects.toThrow(/RULE-EXAM-16/);
    expect(examRlsContext.applyManagementScope).not.toHaveBeenCalled();
  });

  test('test_authorizeClassGroup_unknownClassGroup_notFound', async () => {
    const { service } = buildService({ classGroup: null });

    await expect(service.authorizeClassGroup('teacher-1', 'class-group-1')).rejects.toThrow(/class_group .* not found/);
  });

  test('test_authorizeExam_routesAuthorizationThroughTheExamsClassGroup', async () => {
    const { service, leadershipScope } = buildService({ authorized: true });

    const exam = await service.authorizeExam('teacher-1', 'exam-1');

    expect(exam.id).toBe('exam-1');
    expect(leadershipScope.hasAuthorityOverClassGroup).toHaveBeenCalledWith('teacher-1', 'course-1', 'class-group-1');
  });

  test('test_authorizeExam_unknownExam_notFound', async () => {
    const { service } = buildService({ exam: null });

    await expect(service.authorizeExam('teacher-1', 'exam-1')).rejects.toThrow(/exam .* not found/);
  });
});
