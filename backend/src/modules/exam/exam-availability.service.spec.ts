import { ClassGroupEnrollmentEntity, ExamEntity, TenantEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ExamAvailabilityService } from './exam-availability.service';

// RULE-EXAM-02 (institution type), RULE-EXAM-06 (availability window),
// RULE-EXAM-16 (active enrollment) and the DRAFT/PUBLISHED gate confirmed on
// 2026-09-03 — the four independent reasons a student may not be looking at
// an exam.
describe('ExamAvailabilityService', () => {
  const publishedExam = {
    id: 'exam-1',
    classGroupId: 'class-group-1',
    status: 'PUBLISHED',
    availableFrom: new Date('2026-09-03T10:00:00.000Z'),
    availableUntil: new Date('2026-09-03T12:00:00.000Z'),
  } as ExamEntity;

  function buildService(options: { institutionType?: string; enrollmentCount?: number; enrollments?: unknown[] } = {}) {
    const tenantRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'tenant-a-id', institutionType: options.institutionType ?? 'faculdade' }),
    });
    const enrollmentRepo: MockRepository = createMockRepository({
      count: jest.fn().mockResolvedValue(options.enrollmentCount ?? 1),
      find: jest.fn().mockResolvedValue(options.enrollments ?? []),
    });

    const manager = createMockEntityManager(
      new Map([
        [TenantEntity, tenantRepo],
        [ClassGroupEnrollmentEntity, enrollmentRepo],
      ]),
    );
    const service = new ExamAvailabilityService(createMockTenantContext(manager) as never);
    return { service, tenantRepo, enrollmentRepo };
  }

  describe('windowState', () => {
    const { service } = buildService();

    test('test_windowState_beforeWindow_notAvailable', () => {
      expect(service.windowState(publishedExam, new Date('2026-09-03T09:59:59.000Z'))).toBe('EXAM_NOT_AVAILABLE');
    });

    test('test_windowState_insideWindow_available', () => {
      expect(service.windowState(publishedExam, new Date('2026-09-03T11:00:00.000Z'))).toBe('EXAM_AVAILABLE');
    });

    test('test_windowState_afterWindow_closed', () => {
      expect(service.windowState(publishedExam, new Date('2026-09-03T12:00:01.000Z'))).toBe('EXAM_CLOSED');
    });

    // Both boundaries are inclusive: the window opens exactly at
    // availableFrom and is still open exactly at availableUntil.
    test('test_windowState_exactlyAtStart_available', () => {
      expect(service.windowState(publishedExam, new Date('2026-09-03T10:00:00.000Z'))).toBe('EXAM_AVAILABLE');
    });

    test('test_windowState_exactlyAtEnd_available', () => {
      expect(service.windowState(publishedExam, new Date('2026-09-03T12:00:00.000Z'))).toBe('EXAM_AVAILABLE');
    });
  });

  describe('assertExamAreaEnabled', () => {
    test.each(['faculdade', 'escola'])('test_assertExamAreaEnabled_%s_allowed', async (institutionType) => {
      const { service } = buildService({ institutionType });
      await expect(service.assertExamAreaEnabled()).resolves.toBeUndefined();
    });

    // RULE-EXAM-02 — "empresa" was definitively disqualified as an
    // institution type, but a legacy/unknown value must still not slip
    // through this gate.
    test('test_assertExamAreaEnabled_unknownInstitutionType_forbidden', async () => {
      const { service } = buildService({ institutionType: 'empresa' });
      await expect(service.assertExamAreaEnabled()).rejects.toThrow(/RULE-EXAM-02/);
    });
  });

  describe('assertStudentVisibility', () => {
    test('test_assertStudentVisibility_publishedAndEnrolled_passes', async () => {
      const { service } = buildService();
      await expect(service.assertStudentVisibility('student-1', publishedExam)).resolves.toBeUndefined();
    });

    // Confirmed 2026-09-03: a DRAFT exam does not exist for a student, and
    // the refusal deliberately does not reveal that it exists as a draft.
    test('test_assertStudentVisibility_draftExam_forbidden', async () => {
      const { service } = buildService();
      const draft = { ...publishedExam, status: 'DRAFT' } as ExamEntity;
      await expect(service.assertStudentVisibility('student-1', draft)).rejects.toThrow(/is not available to you/);
    });

    // RULE-EXAM-16: eligibility requires an ACTIVE enrollment — a trancado
    // or evadido student is not eligible.
    test('test_assertStudentVisibility_noActiveEnrollment_forbidden', async () => {
      const { service, enrollmentRepo } = buildService({ enrollmentCount: 0 });
      await expect(service.assertStudentVisibility('student-1', publishedExam)).rejects.toThrow(/RULE-EXAM-16/);
      expect(enrollmentRepo.count).toHaveBeenCalledWith({
        where: { personId: 'student-1', classGroupId: 'class-group-1', enrollmentStatus: 'active' },
      });
    });
  });

  describe('assertStartable', () => {
    test('test_assertStartable_insideWindow_passes', async () => {
      const { service } = buildService();
      await expect(
        service.assertStartable('student-1', publishedExam, new Date('2026-09-03T11:00:00.000Z')),
      ).resolves.toBeUndefined();
    });

    test('test_assertStartable_beforeWindow_forbidden', async () => {
      const { service } = buildService();
      await expect(
        service.assertStartable('student-1', publishedExam, new Date('2026-09-03T09:00:00.000Z')),
      ).rejects.toThrow(/EXAM_NOT_AVAILABLE/);
    });

    test('test_assertStartable_afterWindow_forbidden', async () => {
      const { service } = buildService();
      await expect(
        service.assertStartable('student-1', publishedExam, new Date('2026-09-03T13:00:00.000Z')),
      ).rejects.toThrow(/EXAM_CLOSED/);
    });
  });

  test('test_activeEnrollmentClassGroupIds_deduplicatesClassGroups', async () => {
    const { service } = buildService({
      enrollments: [
        { classGroupId: 'class-group-1' },
        { classGroupId: 'class-group-1' },
        { classGroupId: 'class-group-2' },
      ],
    });

    await expect(service.activeEnrollmentClassGroupIds('student-1')).resolves.toEqual(['class-group-1', 'class-group-2']);
  });
});
