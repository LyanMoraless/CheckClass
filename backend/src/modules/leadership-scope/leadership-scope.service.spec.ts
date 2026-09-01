import { IsNull } from 'typeorm';
import { LeadershipAssignmentEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
} from '../../../test/unit/support/mock-entity-manager';
import { LeadershipScopeService } from './leadership-scope.service';

// RULE-ATT-12 / RULE-INST-09: same three-branch leadership_assignment
// scoping model (class_group-scoped, whole-course, institution-wide) that
// used to live only inside PendingReviewService.isAuthorizedToResolve()
// before this extraction — see pending-review.service.spec.ts for the
// consumer-side coverage of that refactor.
describe('LeadershipScopeService', () => {
  function buildService(count: number) {
    const leadershipRepo = createMockRepository({ count: jest.fn().mockResolvedValue(count) });
    const manager = createMockEntityManager(new Map([[LeadershipAssignmentEntity, leadershipRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const service = new LeadershipScopeService(tenantContext as never);
    return { service, leadershipRepo };
  }

  describe('hasAuthorityOverClassGroup', () => {
    test('test_hasAuthorityOverClassGroup_noMatchingAssignment_returnsFalse', async () => {
      const { service } = buildService(0);

      const result = await service.hasAuthorityOverClassGroup('random-person', 'course-1', 'class-group-1');

      expect(result).toBe(false);
    });

    test('test_hasAuthorityOverClassGroup_matchingAssignment_returnsTrue', async () => {
      const { service } = buildService(1);

      const result = await service.hasAuthorityOverClassGroup('professor-1', 'course-1', 'class-group-1');

      expect(result).toBe(true);
    });

    test('test_hasAuthorityOverClassGroup_queriesAllThreeRuleAtt12Branches', async () => {
      const { service, leadershipRepo } = buildService(1);

      await service.hasAuthorityOverClassGroup('ceo-1', 'course-1', 'class-group-1');

      expect(leadershipRepo.count).toHaveBeenCalledWith({
        where: [
          { personId: 'ceo-1', courseId: 'course-1', classGroupId: 'class-group-1' },
          { personId: 'ceo-1', courseId: 'course-1', classGroupId: IsNull() },
          { personId: 'ceo-1', courseId: IsNull() },
        ],
      });
    });
  });

  describe('hasAuthorityOverCourse', () => {
    test('test_hasAuthorityOverCourse_noMatchingAssignment_returnsFalse', async () => {
      const { service } = buildService(0);

      const result = await service.hasAuthorityOverCourse('random-person', 'course-1');

      expect(result).toBe(false);
    });

    test('test_hasAuthorityOverCourse_courseWideAssignment_returnsTrue', async () => {
      const { service } = buildService(1);

      const result = await service.hasAuthorityOverCourse('coordinator-1', 'course-1');

      expect(result).toBe(true);
    });

    test('test_hasAuthorityOverCourse_queriesOnlyTheTwoCourseWideBranches', async () => {
      // Deliberately does NOT include a class_group-scoped branch — a
      // teacher of one turma under this course must not thereby gain
      // authority to create another turma under the same course.
      const { service, leadershipRepo } = buildService(1);

      await service.hasAuthorityOverCourse('director-1', 'course-1');

      expect(leadershipRepo.count).toHaveBeenCalledWith({
        where: [
          { personId: 'director-1', courseId: 'course-1', classGroupId: IsNull() },
          { personId: 'director-1', courseId: IsNull() },
        ],
      });
    });
  });
});
