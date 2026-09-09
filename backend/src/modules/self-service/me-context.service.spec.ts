import { EntityNotFoundError } from 'typeorm';
import { TenantEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { MeContextService } from './me-context.service';

describe('MeContextService', () => {
  function buildService(options: {
    isStudentRows?: unknown[];
    teaching?: unknown[];
    courseScope?: { allCourses: boolean; courseIds: string[] };
    coordinatingCourseRows?: unknown[];
    institutionType?: string;
  }) {
    const tenantRepo: MockRepository = createMockRepository({
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'tenant-a-id', institutionType: options.institutionType ?? 'faculdade' }),
    });
    const manager = createMockEntityManager(new Map([[TenantEntity, tenantRepo]]));
    // First manager.query call resolves isStudent's row set; a second call
    // (if made) resolves coordinatingCourses' row set.
    manager.query
      .mockResolvedValueOnce(options.isStudentRows ?? [])
      .mockResolvedValueOnce(options.coordinatingCourseRows ?? []);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const leadershipScope = {
      getCourseScope: jest.fn().mockResolvedValue(options.courseScope ?? { allCourses: false, courseIds: [] }),
    };
    const teachingClassGroups = {
      getTeachingClassGroups: jest.fn().mockResolvedValue(options.teaching ?? []),
    };
    const service = new MeContextService(tenantContext as never, leadershipScope as never, teachingClassGroups as never);
    return { service, manager, leadershipScope, teachingClassGroups, tenantRepo };
  }

  test('test_getContext_studentWithNoLeadership_returnsIsStudentTrueAndEmptyLeadershipFields', async () => {
    const { service } = buildService({ isStudentRows: [{ '?column?': 1 }] });

    const result = await service.getContext('student-1');

    expect(result).toEqual({ isStudent: true, teaching: [], coordinating: [], isDirection: false, institutionType: 'faculdade' });
  });

  test('test_getContext_notEnrolledAsStudent_returnsIsStudentFalse', async () => {
    const { service } = buildService({ isStudentRows: [] });

    const result = await service.getContext('teacher-1');

    expect(result.isStudent).toBe(false);
  });

  test('test_getContext_teacher_passesThroughTeachingClassGroupsServiceResult', async () => {
    const teaching = [{ classGroupId: 'class-group-1', classGroupName: 'A', subjectName: 'Cálculo', courseName: 'Eng' }];
    const { service } = buildService({ teaching });

    const result = await service.getContext('teacher-1');

    expect(result.teaching).toEqual(teaching);
  });

  // RULE-JUST-10: the frontend needs institutionType to decide whether to
  // show the Justificativa de Faltas navigation — GET /v1/me/context is
  // where that value now travels from.
  test('test_getContext_faculdadeTenant_returnsInstitutionTypeFaculdade', async () => {
    const { service } = buildService({ institutionType: 'faculdade' });

    const result = await service.getContext('student-1');

    expect(result.institutionType).toBe('faculdade');
  });

  test('test_getContext_escolaTenant_returnsInstitutionTypeEscola', async () => {
    const { service } = buildService({ institutionType: 'escola' });

    const result = await service.getContext('student-1');

    expect(result.institutionType).toBe('escola');
  });

  test('test_getContext_readsInstitutionTypeFromCurrentTenant', async () => {
    const { service, tenantRepo } = buildService({});

    await service.getContext('student-1');

    expect(tenantRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 'tenant-a-id' });
  });

  // Coverage gap flagged by the Testing Agent during RULE-JUST-10 validation:
  // institutionType() uses findOneByOrFail on the deliberate assumption that
  // a request never reaches this service without an already-authenticated
  // JWT for a tenantId that exists (see the comment on institutionType() in
  // me-context.service.ts) — this test exists purely to pin down that, as of
  // today, that assumption is NOT backstopped by any error handling: if it
  // ever turned out to be wrong (or the tenant is deleted mid-session), the
  // raw TypeORM EntityNotFoundError propagates all the way out of
  // getContext() uncaught, which Nest's default exception filter turns into
  // a generic 500 (it is not a NestJS HttpException). This is treated as
  // acceptable, not a bug — same "structurally unreachable, don't add
  // defensive plumbing for it" reasoning already used elsewhere in the
  // codebase (e.g. class-group-deletion-orchestrator.service.ts's handling
  // of enum cases sourced from a DB CHECK constraint) — so if this test
  // starts failing because someone added a try/catch, that is an
  // intentional behavior change, not a regression to silently "fix".
  test('test_getContext_tenantNotFound_propagatesEntityNotFoundErrorUncaught', async () => {
    const { service, tenantRepo } = buildService({});
    tenantRepo.findOneByOrFail.mockRejectedValue(new EntityNotFoundError(TenantEntity, { id: 'tenant-a-id' }));

    await expect(service.getContext('student-1')).rejects.toBeInstanceOf(EntityNotFoundError);
  });

  test('test_getContext_courseWideCoordinator_resolvesCourseNamesForCoordinating', async () => {
    const { service, manager } = buildService({
      courseScope: { allCourses: false, courseIds: ['course-1'] },
      coordinatingCourseRows: [{ courseId: 'course-1', courseName: 'Engenharia' }],
    });

    const result = await service.getContext('coordinator-1');

    expect(result.coordinating).toEqual([{ courseId: 'course-1', courseName: 'Engenharia' }]);
    expect(result.isDirection).toBe(false);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('FROM course'), ['tenant-a-id', ['course-1']]);
  });

  test('test_getContext_institutionWideAssignment_returnsIsDirectionTrueWithoutInflatingCoordinating', async () => {
    const { service } = buildService({ courseScope: { allCourses: true, courseIds: [] } });

    const result = await service.getContext('director-1');

    expect(result.isDirection).toBe(true);
    expect(result.coordinating).toEqual([]);
  });

  test('test_getContext_dualRole_bothTeachingAndCoordinatingArePopulatedIndependently', async () => {
    const teaching = [{ classGroupId: 'class-group-1', classGroupName: 'A', subjectName: 'Cálculo', courseName: 'Eng' }];
    const { service } = buildService({
      teaching,
      courseScope: { allCourses: false, courseIds: ['course-1'] },
      coordinatingCourseRows: [{ courseId: 'course-1', courseName: 'Engenharia' }],
    });

    const result = await service.getContext('dual-role-person');

    expect(result.teaching).toEqual(teaching);
    expect(result.coordinating).toEqual([{ courseId: 'course-1', courseName: 'Engenharia' }]);
  });
});
