import { IsNull, Not } from 'typeorm';
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

  function buildServiceWithAssignments(assignments: Array<{ courseId: string | null }>) {
    const leadershipRepo = createMockRepository({ find: jest.fn().mockResolvedValue(assignments) });
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

  describe('getCourseScope', () => {
    test('test_getCourseScope_noAssignments_returnsEmptyScope', async () => {
      const { service } = buildServiceWithAssignments([]);

      const result = await service.getCourseScope('random-person');

      expect(result).toEqual({ allCourses: false, courseIds: [] });
    });

    test('test_getCourseScope_institutionWideAssignment_returnsAllCoursesTrue', async () => {
      const { service } = buildServiceWithAssignments([{ courseId: null }]);

      const result = await service.getCourseScope('director-1');

      expect(result).toEqual({ allCourses: true, courseIds: [] });
    });

    test('test_getCourseScope_courseWideAssignments_returnsDistinctCourseIds', async () => {
      const { service } = buildServiceWithAssignments([{ courseId: 'course-1' }, { courseId: 'course-2' }, { courseId: 'course-1' }]);

      const result = await service.getCourseScope('coordinator-1');

      expect(result).toEqual({ allCourses: false, courseIds: ['course-1', 'course-2'] });
    });

    test('test_getCourseScope_bothInstitutionWideAndCourseWide_returnsBoth', async () => {
      const { service } = buildServiceWithAssignments([{ courseId: null }, { courseId: 'course-1' }]);

      const result = await service.getCourseScope('director-1');

      expect(result).toEqual({ allCourses: true, courseIds: ['course-1'] });
    });

    test('test_getCourseScope_queriesOnlyTheTwoCourseWideBranches', async () => {
      // Same exclusion as hasAuthorityOverCourse: a class_group-scoped
      // (teacher) assignment must never surface here.
      const { service, leadershipRepo } = buildServiceWithAssignments([]);

      await service.getCourseScope('person-1');

      // Deliberately no `select` here — verified against real Postgres
      // (not just this mock) that a `select` array omitting the primary key
      // silently empties the result set for this multi-OR `where` shape.
      // This assertion exists specifically to catch a regression back to
      // that broken form.
      expect(leadershipRepo.find).toHaveBeenCalledWith({
        where: [
          { personId: 'person-1', courseId: IsNull() },
          { personId: 'person-1', courseId: Not(IsNull()), classGroupId: IsNull() },
        ],
      });
    });
  });
});
