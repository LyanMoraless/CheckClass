import { AttendancePendingReviewEntity, ClassGroupEntity, ClassSessionEntity, SessionAttendanceConsolidationEntity, SubjectEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { PendingReviewService } from './pending-review.service';

// RULE-ATT-11 (a resolved review stays resolved — no re-review workflow) and
// RULE-ATT-12 (resolution authorized to anyone in the direct leadership
// chain above the session's specific class_group: a class_group-scoped
// assignment, a whole-course assignment, or an institution-wide
// course_id-NULL assignment; unrelated people are not). The three-branch
// scoping itself now lives in LeadershipScopeService — see
// leadership-scope.service.spec.ts for that coverage; here it's mocked as a
// single authorized/unauthorized boolean seam.
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
  const classGroup = { id: 'class-group-1', subjectId: 'subject-1' };
  const subject = { id: 'subject-1', courseId: 'course-1' };

  function buildService(options: {
    pendingReview?: unknown;
    authorized?: boolean;
    pendingReviewRepo?: MockRepository;
  }) {
    const pendingReviewRepo =
      options.pendingReviewRepo ??
      createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.pendingReview ?? pendingReview) });
    const sessionRepo = createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(session) });
    const classGroupRepo = createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(classGroup) });
    const subjectRepo = createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(subject) });
    const consolidationRepo = createMockRepository();

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AttendancePendingReviewEntity, pendingReviewRepo],
      [ClassSessionEntity, sessionRepo],
      [ClassGroupEntity, classGroupRepo],
      [SubjectEntity, subjectRepo],
      [SessionAttendanceConsolidationEntity, consolidationRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);
    const leadershipScope = {
      hasAuthorityOverClassGroup: jest.fn().mockResolvedValue(options.authorized ?? false),
      hasAuthorityOverCourse: jest.fn(),
    };
    const service = new PendingReviewService(tenantContext as never, leadershipScope as never);
    return { service, pendingReviewRepo, consolidationRepo, leadershipScope };
  }

  test('test_resolve_rejectsDecisionOtherThanPresentOrAbsent', async () => {
    const { service } = buildService({ authorized: true });

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
    // RULE-ATT-12 negative case: LeadershipScopeService reports no matching
    // assignment for this person against this course/class_group.
    const { service } = buildService({ authorized: false });

    await expect(service.resolve('pending-1', 'random-person', 'present')).rejects.toThrow(/not in the direct leadership chain/);
  });

  test('test_resolve_authorizedPerson_authorizesResolution', async () => {
    const { service, pendingReviewRepo } = buildService({ authorized: true });

    await service.resolve('pending-1', 'professor-1', 'present');

    expect(pendingReviewRepo.update).toHaveBeenCalledWith(
      { id: 'pending-1' },
      expect.objectContaining({ resolvedByPersonId: 'professor-1' }),
    );
  });

  test('test_resolve_delegatesAuthorizationToLeadershipScopeService_withCourseAndClassGroupDerivedFromSession', async () => {
    // Verifies resolve() asks LeadershipScopeService using the courseId
    // derived through session -> class_group -> subject.courseId (RULE-INST-03)
    // and the class_group id itself — not just that SOME check happened.
    const { service, leadershipScope } = buildService({ authorized: true });

    await service.resolve('pending-1', 'ceo-1', 'absent');

    expect(leadershipScope.hasAuthorityOverClassGroup).toHaveBeenCalledWith('ceo-1', 'course-1', 'class-group-1');
  });

  test('test_resolve_updatesConsolidationStatusAndResolutionMetadata_onSuccess', async () => {
    const { service, consolidationRepo } = buildService({ authorized: true });

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
      const leadershipScope = { hasAuthorityOverClassGroup: jest.fn(), hasAuthorityOverCourse: jest.fn() };
      return { service: new PendingReviewService(tenantContext as never, leadershipScope as never), manager };
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
