import { IsNull } from 'typeorm';
import {
  AttendancePendingReviewEntity,
  ClassGroupEntity,
  ClassSessionEntity,
  LeadershipAssignmentEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { PendingReviewService } from './pending-review.service';

// RULE-ATT-11 (a resolved review stays resolved — no re-review workflow) and
// RULE-ATT-12 (resolution authorized to anyone in the direct leadership
// chain above the session's specific class_group: a class_group-scoped
// assignment, a whole-course assignment, or an institution-wide
// course_id-NULL assignment; unrelated people are not).
describe('PendingReviewService', () => {
  const pendingReview = {
    id: 'pending-1',
    tenantId: 'tenant-a-id',
    classSessionId: 'session-1',
    personId: 'student-1',
    reason: 'missing_factor',
    resolvedByPersonId: null,
    resolvedAt: null,
    resolutionNote: null,
    createdAt: new Date(),
  };
  const session = { id: 'session-1', classGroupId: 'class-group-1' };
  const classGroup = { id: 'class-group-1', courseId: 'course-1' };

  function buildService(options: {
    pendingReview?: unknown;
    leadershipCount?: number;
    pendingReviewRepo?: MockRepository;
    leadershipRepo?: MockRepository;
  }) {
    const pendingReviewRepo =
      options.pendingReviewRepo ??
      createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.pendingReview ?? pendingReview) });
    const sessionRepo = createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(session) });
    const classGroupRepo = createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(classGroup) });
    const leadershipRepo =
      options.leadershipRepo ?? createMockRepository({ count: jest.fn().mockResolvedValue(options.leadershipCount ?? 0) });
    const consolidationRepo = createMockRepository();

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AttendancePendingReviewEntity, pendingReviewRepo],
      [ClassSessionEntity, sessionRepo],
      [ClassGroupEntity, classGroupRepo],
      [LeadershipAssignmentEntity, leadershipRepo],
      [SessionAttendanceConsolidationEntity, consolidationRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);
    const service = new PendingReviewService(tenantContext as never);
    return { service, pendingReviewRepo, leadershipRepo, consolidationRepo };
  }

  test('test_resolve_rejectsDecisionOtherThanPresentOrAbsent', async () => {
    const { service } = buildService({ leadershipCount: 1 });

    await expect(service.resolve('pending-1', 'leader-1', 'excused' as never)).rejects.toThrow(
      /decision must be "present" or "absent"/,
    );
  });

  test('test_resolve_throwsNotFound_whenPendingReviewDoesNotExist', async () => {
    const pendingReviewRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ pendingReviewRepo });

    await expect(service.resolve('missing-pending', 'leader-1', 'present')).rejects.toThrow(/not found/);
  });

  test('test_resolve_rejectsResolvingAnAlreadyResolvedReview', async () => {
    // RULE-ATT-11: not a re-review workflow — a resolved review stays resolved.
    const { service } = buildService({
      pendingReview: { ...pendingReview, resolvedAt: new Date('2026-08-20T00:00:00.000Z') },
    });

    await expect(service.resolve('pending-1', 'leader-1', 'present')).rejects.toThrow(/already been resolved/);
  });

  test('test_resolve_unrelatedPerson_throwsForbidden', async () => {
    // RULE-ATT-12 negative case: no leadership_assignment row at all for this
    // person against this course (course-scoped or institution-wide).
    const { service } = buildService({ leadershipCount: 0 });

    await expect(service.resolve('pending-1', 'random-person', 'present')).rejects.toThrow(/not in the direct leadership chain/);
  });

  test('test_resolve_courseScopedLeadershipAssignment_authorizesResolution', async () => {
    // RULE-ATT-12: e.g. the professor of this exact course.
    const { service, pendingReviewRepo } = buildService({ leadershipCount: 1 });

    await service.resolve('pending-1', 'professor-1', 'present');

    expect(pendingReviewRepo.update).toHaveBeenCalledWith(
      { id: 'pending-1' },
      expect.objectContaining({ resolvedByPersonId: 'professor-1' }),
    );
  });

  test('test_resolve_institutionWideAssignment_courseIdNull_authorizesResolution', async () => {
    // RULE-ATT-12: e.g. the institution's top administrative role, whose
    // leadership_assignment.course_id is NULL, reaching every course — even
    // though this person has no assignment scoped to this exact course, the
    // count query's second OR-branch (courseId IS NULL) is what the real DB
    // would match, so returning 1 here simulates that.
    const { service, pendingReviewRepo } = buildService({ leadershipCount: 1 });

    await service.resolve('pending-1', 'ceo-1', 'absent');

    expect(pendingReviewRepo.update).toHaveBeenCalledWith(
      { id: 'pending-1' },
      expect.objectContaining({ resolvedByPersonId: 'ceo-1' }),
    );
  });

  test('test_resolve_authorizationCheck_queriesAllThreeRuleAtt12Branches', async () => {
    // Verifies the service asks the DB to check all three RULE-ATT-12
    // branches: exact class_group match, whole-course (class_group_id NULL),
    // and institution-wide (course_id NULL) — not just the course-scoped one.
    const { service, leadershipRepo } = buildService({ leadershipCount: 1 });

    await service.resolve('pending-1', 'ceo-1', 'absent');

    expect(leadershipRepo.count).toHaveBeenCalledWith({
      where: [
        { personId: 'ceo-1', courseId: 'course-1', classGroupId: 'class-group-1' },
        { personId: 'ceo-1', courseId: 'course-1', classGroupId: IsNull() },
        { personId: 'ceo-1', courseId: IsNull() },
      ],
    });
  });

  test('test_resolve_classGroupScopedLeadershipAssignment_authorizesResolution', async () => {
    // RULE-ATT-12 granularity fix: an assignment scoped to exactly this
    // class_group (e.g. "professor of this specific turma") authorizes
    // resolution even without a broader course-wide or institution-wide role.
    const { service, pendingReviewRepo } = buildService({ leadershipCount: 1 });

    await service.resolve('pending-1', 'turma-professor-1', 'present');

    expect(pendingReviewRepo.update).toHaveBeenCalledWith(
      { id: 'pending-1' },
      expect.objectContaining({ resolvedByPersonId: 'turma-professor-1' }),
    );
  });

  test('test_resolve_updatesConsolidationStatusAndResolutionMetadata_onSuccess', async () => {
    const { service, consolidationRepo } = buildService({ leadershipCount: 1 });

    await service.resolve('pending-1', 'professor-1', 'absent', 'Confirmed absent after review');

    expect(consolidationRepo.update).toHaveBeenCalledWith(
      { classSessionId: 'session-1', personId: 'student-1' },
      expect.objectContaining({ status: 'absent', resolvedByPersonId: 'professor-1' }),
    );
  });

  test('test_listUnresolved_queriesOnlyReviewsWithNullResolvedAt', async () => {
    const findByMock = jest.fn().mockResolvedValue([pendingReview]);
    const pendingReviewRepo = createMockRepository({ findBy: findByMock });
    const { service } = buildService({ pendingReviewRepo });

    const result = await service.listUnresolved();

    expect(result).toEqual([pendingReview]);
    expect(findByMock).toHaveBeenCalledWith(expect.objectContaining({ resolvedAt: expect.anything() }));
  });

  // RULE-ATT-12, inverted into a filter (mobile Professor use case): "list
  // only the pending reviews this person is authorized to resolve".
  //
  // Performance finding (N+1): listUnresolvedForPerson used to loop over
  // every unresolved review doing a session lookup + a class_group lookup +
  // a leadership count query per row. It's now a single manager.query() call
  // (join + correlated EXISTS against leadership_assignment) — these specs
  // mock that one query call directly (same style as
  // AppCheckinService.resolveActiveClassSession's own spec) rather than the
  // old per-repository mocks, since the authorization decision itself now
  // lives inside the SQL rather than in this service's own control flow.
  // The actual SQL's correctness against all three RULE-ATT-12 branches
  // (class_group-scoped, whole-course, institution-wide) was verified
  // manually against a real Postgres instance during implementation; it is
  // NOT re-derivable at the unit level once expressed as raw SQL like this,
  // which is the trade-off of collapsing the N+1 into one query.
  describe('listUnresolvedForPerson', () => {
    const reviewA = { ...pendingReview, id: 'pending-a', classSessionId: 'session-a' };
    const reviewB = { ...pendingReview, id: 'pending-b', classSessionId: 'session-b' };

    function buildQueryOnlyService(queryResult: unknown[]) {
      const manager = createMockEntityManager();
      manager.query.mockResolvedValue(queryResult);
      const tenantContext = createMockTenantContext(manager);
      return { service: new PendingReviewService(tenantContext as never), manager };
    }

    test('test_listUnresolvedForPerson_noAuthorizedReviews_returnsEmpty', async () => {
      const { service } = buildQueryOnlyService([]);

      const result = await service.listUnresolvedForPerson('random-person');

      expect(result).toEqual([]);
    });

    test('test_listUnresolvedForPerson_authorizedForSomeReviews_returnsExactlyWhatTheQueryResolvedTo', async () => {
      const { service } = buildQueryOnlyService([reviewA]);

      const result = await service.listUnresolvedForPerson('professor-a');

      expect(result).toEqual([reviewA]);
    });

    test('test_listUnresolvedForPerson_institutionWideLeader_returnsEveryRowTheQueryResolvedTo', async () => {
      const { service } = buildQueryOnlyService([reviewA, reviewB]);

      const result = await service.listUnresolvedForPerson('ceo-1');

      expect(result).toEqual([reviewA, reviewB]);
    });

    test('test_listUnresolvedForPerson_queriesByTenantAndPerson_joiningSessionAndClassGroupWithLeadershipExists', async () => {
      const { service, manager } = buildQueryOnlyService([reviewA]);

      await service.listUnresolvedForPerson('professor-a');

      expect(manager.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /attendance_pending_review[\s\S]*class_session[\s\S]*class_group[\s\S]*EXISTS[\s\S]*leadership_assignment/,
        ),
        ['tenant-a-id', 'professor-a'],
      );
    });
  });
});
