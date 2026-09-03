import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { CoordinatedClassGroupsService } from './coordinated-class-groups.service';

describe('CoordinatedClassGroupsService', () => {
  function buildService(scope: { allCourses: boolean; courseIds: string[] }, rows: unknown[] = []) {
    const manager = createMockEntityManager();
    manager.query.mockResolvedValue(rows);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const leadershipScope = { getCourseScope: jest.fn().mockResolvedValue(scope) };
    const service = new CoordinatedClassGroupsService(tenantContext as never, leadershipScope as never);
    return { service, manager, leadershipScope };
  }

  test('test_getCoordinatedClassGroups_noScopeAtAll_returnsEmptyWithoutQuerying', async () => {
    const { service, manager } = buildService({ allCourses: false, courseIds: [] });

    const result = await service.getCoordinatedClassGroups('random-person');

    expect(result).toEqual([]);
    expect(manager.query).not.toHaveBeenCalled();
  });

  test('test_getCoordinatedClassGroups_specificCourseIds_queriesScopedByThoseCourseIds', async () => {
    const { service, manager } = buildService({ allCourses: false, courseIds: ['course-1', 'course-2'] });

    await service.getCoordinatedClassGroups('coordinator-1');

    expect(manager.query).toHaveBeenCalledWith(expect.any(String), ['tenant-a-id', false, ['course-1', 'course-2']]);
  });

  test('test_getCoordinatedClassGroups_allCourses_queriesWithAllCoursesFlagTrue', async () => {
    const { service, manager } = buildService({ allCourses: true, courseIds: [] });

    await service.getCoordinatedClassGroups('director-1');

    expect(manager.query).toHaveBeenCalledWith(expect.any(String), ['tenant-a-id', true, []]);
  });

  test('test_getCoordinatedClassGroups_returnsRowsResolvedFromTheQuery', async () => {
    const rows = [{ classGroupId: 'class-group-1', classGroupName: 'Turma A', subjectName: 'Cálculo I', courseName: 'Engenharia' }];
    const { service } = buildService({ allCourses: false, courseIds: ['course-1'] }, rows);

    const result = await service.getCoordinatedClassGroups('coordinator-1');

    expect(result).toEqual(rows);
  });
});
