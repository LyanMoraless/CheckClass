import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { StudentDirectoryService } from './student-directory.service';

// Backs the dedicated "Alunos" screen. The service issues a single flattened
// query (one row per enrollment) and groups it into one entry per person in
// TypeScript — these specs exercise that grouping directly against
// manager.query() mock results, same style as
// PendingReviewService.listUnresolvedForPerson's own spec.
describe('StudentDirectoryService', () => {
  function buildService(rows: unknown[]) {
    const manager = createMockEntityManager();
    manager.query.mockResolvedValue(rows);
    const tenantContext = createMockTenantContext(manager);
    const service = new StudentDirectoryService(tenantContext as never);
    return { service, manager };
  }

  const baseRow = {
    personId: 'person-1',
    fullName: 'Jane Student',
    hasLoginCredential: true,
    classGroupId: 'class-group-1',
    classGroupName: 'Cálculo I - Turma A',
    subjectNames: ['Cálculo I', 'Física I'],
    courseName: 'Engenharia',
    enrollmentStatus: 'active',
  };

  test('test_list_studentWithOneEnrollment_returnsSingleStudentWithOneEnrollment', async () => {
    const { service } = buildService([baseRow]);

    const result = await service.list();

    expect(result).toEqual([
      {
        personId: 'person-1',
        fullName: 'Jane Student',
        hasLoginCredential: true,
        enrollments: [
          {
            classGroupId: 'class-group-1',
            classGroupName: 'Cálculo I - Turma A',
            subjectNames: ['Cálculo I', 'Física I'],
            courseName: 'Engenharia',
            enrollmentStatus: 'active',
          },
        ],
      },
    ]);
  });

  test('test_list_studentWithMultipleEnrollments_groupsAllEnrollmentsUnderOneStudentEntry', async () => {
    const secondEnrollmentRow = {
      ...baseRow,
      classGroupId: 'class-group-2',
      classGroupName: 'Álgebra Linear - Turma B',
      subjectNames: ['Álgebra Linear'],
      courseName: 'Engenharia',
      enrollmentStatus: 'on_leave',
    };
    const { service } = buildService([baseRow, secondEnrollmentRow]);

    const result = await service.list();

    expect(result).toHaveLength(1);
    expect(result[0].personId).toBe('person-1');
    expect(result[0].enrollments).toEqual([
      expect.objectContaining({ classGroupId: 'class-group-1', enrollmentStatus: 'active' }),
      expect.objectContaining({ classGroupId: 'class-group-2', enrollmentStatus: 'on_leave' }),
    ]);
  });

  test('test_list_multiplePeople_groupsByPersonIdCorrectly', async () => {
    const otherStudentRow = {
      ...baseRow,
      personId: 'person-2',
      fullName: 'John Other',
      hasLoginCredential: false,
      classGroupId: 'class-group-3',
      classGroupName: 'Cálculo I - Turma A',
      enrollmentStatus: 'graduated',
    };
    const { service } = buildService([baseRow, otherStudentRow]);

    const result = await service.list();

    expect(result).toHaveLength(2);
    expect(result.map((student) => student.personId)).toEqual(['person-1', 'person-2']);
    expect(result[0].enrollments).toHaveLength(1);
    expect(result[1].enrollments).toHaveLength(1);
    expect(result[1]).toMatchObject({ personId: 'person-2', fullName: 'John Other', hasLoginCredential: false });
  });

  test('test_list_personOnlyEnrolledAsTeacher_doesNotAppear_becauseQueryFiltersToStudentRoleOnly', async () => {
    // The query itself filters to role = 'student' — a person who is only a
    // teacher never produces a row here in the first place. This spec
    // documents that expectation on the query text (unit-level: the actual
    // WHERE-clause correctness against Postgres was not re-verified here,
    // same trade-off already accepted for other raw-SQL services in this
    // codebase, e.g. PendingReviewService.listUnresolvedForPerson).
    const { service, manager } = buildService([]);

    const result = await service.list();

    expect(result).toEqual([]);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining("cge.role = 'student'"));
  });

  test('test_list_noEnrollmentsAtAll_returnsEmptyArray', async () => {
    const { service } = buildService([]);

    const result = await service.list();

    expect(result).toEqual([]);
  });

  // RULE-INST-14: the course comes off the turma directly, and the matérias
  // are aggregated from class_group_subject — the join through cg.subject_id
  // is gone, and a turma with no matéria must still list its students
  // (LEFT JOIN LATERAL + empty-array fallback).
  test('test_list_queriesPersonJoinedThroughEnrollmentCourseAndAggregatedSubjects', async () => {
    const { service, manager } = buildService([baseRow]);

    await service.list();

    expect(manager.query).toHaveBeenCalledWith(
      expect.stringMatching(/FROM person p[\s\S]*class_group_enrollment[\s\S]*class_group[\s\S]*course/),
    );
    const [query] = manager.query.mock.calls[0] as [string];
    expect(query).toMatch(/JOIN course c ON c\.id = cg\.course_id/);
    expect(query).toMatch(/LEFT JOIN LATERAL/);
    expect(query).toMatch(/COALESCE\(array_agg\(s\.name ORDER BY s\.name\), '\{\}'::text\[\]\)/);
    expect(query).not.toMatch(/cg\.subject_id/);
  });
});
