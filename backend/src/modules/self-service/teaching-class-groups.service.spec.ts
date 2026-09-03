import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { TeachingClassGroupsService } from './teaching-class-groups.service';

// RULE-INST-05: turmas where this person has class_group_enrollment.role =
// 'teacher' — co-docência is covered by construction (each teacher gets
// their own enrollment row), so no extra branching is expected here.
describe('TeachingClassGroupsService', () => {
  function buildService(rows: unknown[] = []) {
    const manager = createMockEntityManager();
    manager.query.mockResolvedValue(rows);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const service = new TeachingClassGroupsService(tenantContext as never);
    return { service, manager };
  }

  test('test_getTeachingClassGroups_queriesByTenantAndGivenPersonIdOnly', async () => {
    const { service, manager } = buildService();

    await service.getTeachingClassGroups('teacher-1');

    expect(manager.query).toHaveBeenCalledWith(expect.any(String), ['tenant-a-id', 'teacher-1']);
  });

  test('test_getTeachingClassGroups_filtersByTeacherRoleOnly', async () => {
    const { service, manager } = buildService();

    await service.getTeachingClassGroups('teacher-1');

    const [query] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/cge\.role = 'teacher'/);
  });

  test('test_getTeachingClassGroups_joinsSubjectAndCourseForReadableNames', async () => {
    const { service, manager } = buildService();

    await service.getTeachingClassGroups('teacher-1');

    const [query] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/JOIN subject sub ON sub\.id = cg\.subject_id/);
    expect(query).toMatch(/JOIN course c ON c\.id = sub\.course_id/);
  });

  test('test_getTeachingClassGroups_returnsRowsResolvedFromTheQuery', async () => {
    const rows = [
      { classGroupId: 'class-group-1', classGroupName: 'Turma A', subjectName: 'Cálculo I', courseName: 'Engenharia' },
    ];
    const { service } = buildService(rows);

    const result = await service.getTeachingClassGroups('teacher-1');

    expect(result).toEqual(rows);
  });
});
