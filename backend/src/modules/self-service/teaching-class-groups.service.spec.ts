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

  // RULE-INST-14: course comes straight off the turma now, and the matérias
  // are an aggregated set instead of a single joined name — a turma with
  // several matérias must still produce exactly one row per turma.
  test('test_getTeachingClassGroups_joinsCourseDirectlyAndAggregatesSubjectNames', async () => {
    const { service, manager } = buildService();

    await service.getTeachingClassGroups('teacher-1');

    const [query] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/JOIN course c ON c\.id = cg\.course_id/);
    expect(query).toMatch(/array_agg\(s\.name ORDER BY s\.name\)/);
    expect(query).toMatch(/FROM class_group_subject cgs/);
    expect(query).not.toMatch(/cg\.subject_id/);
  });

  // RULE-INST-08 addendum: a turma with zero matérias still belongs to its
  // course and must still appear — the aggregate falls back to an empty
  // array instead of dropping the row.
  test('test_getTeachingClassGroups_keepsTurmaWithNoSubject_viaLeftLateralAndEmptyArrayFallback', async () => {
    const { service, manager } = buildService();

    await service.getTeachingClassGroups('teacher-1');

    const [query] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/LEFT JOIN LATERAL/);
    expect(query).toMatch(/COALESCE\(array_agg\(s\.name ORDER BY s\.name\), '\{\}'::text\[\]\)/);
  });

  test('test_getTeachingClassGroups_returnsRowsResolvedFromTheQuery', async () => {
    const rows = [
      {
        classGroupId: 'class-group-1',
        classGroupName: 'Turma A',
        subjectNames: ['Cálculo I', 'Física I'],
        courseName: 'Engenharia',
      },
    ];
    const { service } = buildService(rows);

    const result = await service.getTeachingClassGroups('teacher-1');

    expect(result).toEqual(rows);
  });
});
