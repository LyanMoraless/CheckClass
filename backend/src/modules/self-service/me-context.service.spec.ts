import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { MeContextService } from './me-context.service';

describe('MeContextService', () => {
  function buildService(options: {
    isStudentRows?: unknown[];
    teaching?: unknown[];
    courseScope?: { allCourses: boolean; courseIds: string[] };
    coordinatingCourseRows?: unknown[];
  }) {
    const manager = createMockEntityManager();
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
    return { service, manager, leadershipScope, teachingClassGroups };
  }

  test('test_getContext_studentWithNoLeadership_returnsIsStudentTrueAndEmptyLeadershipFields', async () => {
    const { service } = buildService({ isStudentRows: [{ '?column?': 1 }] });

    const result = await service.getContext('student-1');

    expect(result).toEqual({ isStudent: true, teaching: [], coordinating: [], isDirection: false });
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
