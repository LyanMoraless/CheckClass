import { ClassGroupSubjectTeacherEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { TeacherSubjectScopeService } from './teacher-subject-scope.service';

// RULE-JUST-06/08/24's narrow authorization primitive: "é o professor
// responsável por esta matéria, nesta turma". This is the application-layer
// gate every decide()/revoke()/attachment-download authorize() call defers
// to — AbsenceJustificationDecisionService.spec.ts and
// AbsenceJustificationAttachmentService.spec.ts both stub it out entirely, so
// this is the only place its own count-based predicate is exercised.
describe('TeacherSubjectScopeService', () => {
  function buildService(count: number) {
    const repo = createMockRepository({ count: jest.fn().mockResolvedValue(count) });
    const manager = createMockEntityManager(new Map([[ClassGroupSubjectTeacherEntity, repo]]));
    const tenantContext = createMockTenantContext(manager);
    const service = new TeacherSubjectScopeService(tenantContext as never);
    return { service, repo };
  }

  test('test_isSubjectTeacher_noMatchingRow_returnsFalse', async () => {
    const { service } = buildService(0);

    const result = await service.isSubjectTeacher('teacher-1', 'class-group-1', 'subject-1');

    expect(result).toBe(false);
  });

  test('test_isSubjectTeacher_matchingRow_returnsTrue', async () => {
    const { service } = buildService(1);

    const result = await service.isSubjectTeacher('teacher-1', 'class-group-1', 'subject-1');

    expect(result).toBe(true);
  });

  // Must be a flat AND across all three columns — a teacher of a DIFFERENT
  // matéria in the same turma, or of the SAME matéria in a different turma,
  // must never pass this check (RULE-JUST-08/24's whole point).
  test('test_isSubjectTeacher_queriesAllThreeColumnsTogether', async () => {
    const { service, repo } = buildService(1);

    await service.isSubjectTeacher('teacher-1', 'class-group-1', 'subject-1');

    expect(repo.count).toHaveBeenCalledWith({
      where: { personId: 'teacher-1', classGroupId: 'class-group-1', subjectId: 'subject-1' },
    });
  });
});
