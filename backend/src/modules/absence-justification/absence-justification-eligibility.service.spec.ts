import { ClassGroupEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { AccumulatedFrequencyPeriod } from '../config/accumulated-frequency-period.enum';
import { AbsenceJustificationEligibilityService } from './absence-justification-eligibility.service';

// RULE-JUST-13/14/15/16: the derivation of eligible class_session rows from
// a student's requested date range — the highest-risk pure logic in Frente
// 07's backend surface, so it gets the deepest unit coverage in this module.
describe('AbsenceJustificationEligibilityService', () => {
  const CLASS_GROUP: ClassGroupEntity = {
    id: 'class-group-1',
    tenantId: 'tenant-a-id',
    courseId: 'course-1',
    name: 'Turma A',
    roomId: null,
    termStartDate: new Date('2026-08-01'),
    termEndDate: new Date('2026-12-31'),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildService(rows: unknown[]) {
    const classGroupRepo = createMockRepository({
      findOneByOrFail: jest.fn().mockResolvedValue(CLASS_GROUP),
    });
    const repositoriesByEntity = new Map<unknown, MockRepository>([[ClassGroupEntity, classGroupRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);
    manager.query.mockResolvedValue(rows);

    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const tenantConfig = {
      resolveEffectiveConfig: jest.fn().mockResolvedValue({
        minAccumulatedFrequencyPercentage: 75,
        accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod.BIMESTER,
      }),
    };

    const service = new AbsenceJustificationEligibilityService(tenantContext as never, tenantConfig as never);
    return { service, manager, tenantConfig };
  }

  function baseRow(overrides: Record<string, unknown> = {}) {
    return {
      class_session_id: 'session-1',
      class_group_id: 'class-group-1',
      subject_id: 'subject-1',
      scheduled_start: '2026-09-01T12:00:00.000Z',
      session_status: 'scheduled',
      consolidation_status: 'absent',
      consolidation_created_at: '2026-09-01T18:00:00.000Z',
      resolved_at: null,
      enrollment_created_at: '2026-01-01T00:00:00.000Z',
      has_under_review_item: false,
      ...overrides,
    };
  }

  test('test_deriveEligibleSessions_absentAndWithinDeadline_isEligible', async () => {
    const { service } = buildService([baseRow()]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.eligible).toEqual([
      { classSessionId: 'session-1', classGroupId: 'class-group-1', subjectId: 'subject-1', scheduledStart: new Date('2026-09-01T12:00:00.000Z') },
    ]);
    expect(result.excluded).toEqual([]);
  });

  test('test_deriveEligibleSessions_sessionCancelled_isExcluded', async () => {
    const { service } = buildService([baseRow({ session_status: 'cancelled' })]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.eligible).toEqual([]);
    expect(result.excluded).toEqual([{ classSessionId: 'session-1', scheduledStart: new Date('2026-09-01T12:00:00.000Z'), reason: 'session_cancelled' }]);
  });

  test('test_deriveEligibleSessions_notEvaluatedYet_isExcluded', async () => {
    const { service } = buildService([baseRow({ consolidation_status: null, consolidation_created_at: null })]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.excluded[0].reason).toBe('not_evaluated_yet');
  });

  // RULE-JUST-14: the correction path for a wrong 'present' is chamada
  // correction, never this flow.
  test('test_deriveEligibleSessions_alreadyPresent_isExcluded', async () => {
    const { service } = buildService([baseRow({ consolidation_status: 'present' })]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.excluded[0].reason).toBe('already_present');
  });

  test('test_deriveEligibleSessions_pendingReview_isExcluded', async () => {
    const { service } = buildService([baseRow({ consolidation_status: 'pending' })]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.excluded[0].reason).toBe('pending_review');
  });

  // RULE-JUST-16.2: a session with an already-approved item is closed to a
  // second one — readable straight off the consolidation status.
  test('test_deriveEligibleSessions_alreadyJustified_isExcluded', async () => {
    const { service } = buildService([baseRow({ consolidation_status: 'absent_justified' })]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.excluded[0].reason).toBe('already_justified');
  });

  // RULE-JUST-16.1: at most one item under_review per session/aluno.
  test('test_deriveEligibleSessions_alreadyUnderReview_isExcluded', async () => {
    const { service } = buildService([baseRow({ has_under_review_item: true })]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.excluded[0].reason).toBe('already_under_review');
  });

  // RULE-JUST-14 item 4: the session must be posterior to the início da
  // matrícula (enrollment.createdAt, this service's documented proxy).
  test('test_deriveEligibleSessions_beforeEnrollment_isExcluded', async () => {
    const { service } = buildService([
      baseRow({ scheduled_start: '2026-01-01T12:00:00.000Z', enrollment_created_at: '2026-02-01T00:00:00.000Z' }),
    ]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-01-01'), new Date('2026-01-01'));

    expect(result.excluded[0].reason).toBe('before_enrollment');
  });

  // RULE-JUST-15.1/15.2: the 15-day clock starts at consolidation_created_at
  // when resolved_at is null (never went through pending review), and the
  // deadline is exclusive at day 16.
  // The service compares against `new Date()` directly (not Date.now()), so
  // these four tests use fake timers (which override the Date constructor
  // itself) rather than jest.spyOn(Date, 'now') (which would not).
  afterEach(() => {
    jest.useRealTimers();
  });

  test('test_deriveEligibleSessions_within15Days_isEligible', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-09-10T00:00:00.000Z'));
    const { service } = buildService([baseRow({ consolidation_created_at: '2026-08-27T00:00:00.000Z' })]); // day 14

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.eligible).toHaveLength(1);
  });

  test('test_deriveEligibleSessions_after15Days_isExcludedDeadlineExpired', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-09-16T00:00:00.001Z')); // day 16
    const { service } = buildService([baseRow({ consolidation_created_at: '2026-08-31T00:00:00.000Z' })]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-08-31'), new Date('2026-08-31'));

    expect(result.excluded[0].reason).toBe('deadline_expired');
  });

  // RULE-JUST-15.1: resolved_at (pending-review resolution), when set, is
  // what "became definitive" means — NOT consolidation_created_at.
  test('test_deriveEligibleSessions_resolvedAtDrivesDeadline_notCreatedAt', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-09-20T00:00:00.000Z'));
    // created_at is old (would already be past deadline), but resolved_at
    // (pending-review resolution) is recent -- the falta only became
    // definitive then.
    const { service } = buildService([
      baseRow({ consolidation_created_at: '2026-01-01T00:00:00.000Z', resolved_at: '2026-09-10T00:00:00.000Z' }),
    ]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.eligible).toHaveLength(1);
  });

  // RULE-JUST-15.3: the earlier of the 15-day clock and the período de
  // apuração closing wins -- here the período (bimester starting 2026-08-01)
  // closes 2026-09-30, before a 15-day clock that would otherwise still be
  // open.
  test('test_deriveEligibleSessions_periodClosesBeforeFifteenDays_isExcludedDeadlineExpired', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
    const { service } = buildService([
      baseRow({ scheduled_start: '2026-09-29T12:00:00.000Z', consolidation_created_at: '2026-09-29T18:00:00.000Z' }),
    ]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-29'), new Date('2026-09-29'));

    expect(result.excluded[0].reason).toBe('deadline_expired');
  });

  test('test_deriveEligibleSessions_partialEligibility_returnsBoth', async () => {
    const { service } = buildService([
      baseRow({ class_session_id: 'session-1' }),
      baseRow({ class_session_id: 'session-2', session_status: 'cancelled' }),
    ]);

    const result = await service.deriveEligibleSessions('person-1', new Date('2026-09-01'), new Date('2026-09-01'));

    expect(result.eligible.map((s) => s.classSessionId)).toEqual(['session-1']);
    expect(result.excluded.map((s) => s.classSessionId)).toEqual(['session-2']);
  });
});
