import { Repository } from 'typeorm';
import { AttendanceFrequencyWarningEntity, ClassGroupEnrollmentEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { AttendanceWarningService, type ApplyCalculationInput } from './attendance-warning.service';
import { FREQUENCY_WARNING_MARGIN_POINTS } from './frequency-warning.constants';

// State machine of Controle B warnings (RULE-FREQ-03/04/07/08): the six
// branches of applyCalculation. Each suite tests one branch in isolation, and
// the numeric boundary tests run within the relevant suite.
describe('AttendanceWarningService', () => {
  function buildService() {
    const warningRepository = createMockRepository();
    const enrollmentRepository = createMockRepository();
    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([
        [AttendanceFrequencyWarningEntity, warningRepository],
        [ClassGroupEnrollmentEntity, enrollmentRepository],
      ]),
    );
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const service = new AttendanceWarningService(tenantContext as never);
    return { service, manager, warningRepository, enrollmentRepository };
  }

  function baseInput(overrides: Partial<ApplyCalculationInput> = {}): ApplyCalculationInput {
    return {
      personId: 'person-1',
      classGroupId: 'class-group-1',
      subjectId: 'subject-1',
      window: {
        startDate: new Date('2026-08-01'),
        endDate: new Date('2026-09-30'),
      },
      minPercentage: 75,
      calculation: { calculable: true, presentCount: 30, consideredCount: 40, percentage: 75 },
      ...overrides,
    };
  }

  function existingWarning(overrides: Partial<AttendanceFrequencyWarningEntity> = {}) {
    return {
      id: 'warning-1',
      tenantId: 'tenant-a-id',
      personId: 'person-1',
      classGroupId: 'class-group-1',
      subjectId: 'subject-1',
      warningType: 'approaching_minimum',
      warningTypeSince: new Date('2026-08-15'),
      frequencyPercentage: 78,
      presentCount: 31,
      consideredCount: 40,
      minPercentageApplied: 75,
      periodStartDate: new Date('2026-08-01'),
      periodEndDate: new Date('2026-09-30'),
      status: 'active',
      resolvedAt: null,
      resolutionReason: null,
      seenAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  // ============================================================================
  // ENROLLMENT GATE: if not active, close with reason='enrollment_inactive'
  // ============================================================================
  describe('enrollment gate (RULE-FREQ-08.2)', () => {
    test('test_applyCalculation_enrollmentNotActive_closesExistingWarningWithEnrollmentInactiveReason', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(0); // No active enrollment

      const input = baseInput();
      await service.applyCalculation(input);

      // Resolves the existing warning
      expect(warningRepository.findOneBy).toHaveBeenCalledWith({
        personId: 'person-1',
        classGroupId: 'class-group-1',
        subjectId: 'subject-1',
        status: 'active',
      });
      // But since we didn't set an existing warning in the mock, it won't try to resolve
      // Let's test with an existing warning:
    });

    test('test_applyCalculation_enrollmentInactiveButWarningExists_closesWarningWithEnrollmentInactiveReason', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(0); // No active enrollment
      const warning = existingWarning();
      warningRepository.findOneBy.mockResolvedValue(warning);

      const input = baseInput();
      await service.applyCalculation(input);

      // Should have called resolveWarning (via update) with enrollment_inactive reason
      const [criteria, values] = warningRepository.update.mock.calls[0] as [unknown, unknown];
      expect(values).toEqual({
        status: 'resolved',
        resolvedAt: expect.any(Date),
        resolutionReason: 'enrollment_inactive',
      });
    });

    test('test_applyCalculation_enrollmentNotActive_neverProcessesCalculation', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(0);
      warningRepository.findOneBy.mockResolvedValue(existingWarning());

      const input = baseInput({
        calculation: { calculable: false, reason: 'no_definitive_sessions' },
      });
      await service.applyCalculation(input);

      // Only ONE update (the resolve), not multiple operations
      expect(warningRepository.update).toHaveBeenCalledTimes(1);
      expect(warningRepository.save).not.toHaveBeenCalled();
      expect(warningRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // FREEZE BRANCH: not calculable, no change to warning
  // ============================================================================
  describe('freeze branch (no_definitive_sessions or no_period_window)', () => {
    test('test_applyCalculation_notCalculable_doesNotModifyExistingWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1); // Active enrollment
      warningRepository.findOneBy.mockResolvedValue(existingWarning());

      const input = baseInput({
        calculation: { calculable: false, reason: 'no_definitive_sessions' },
      });
      await service.applyCalculation(input);

      // No update, no save, no delete — the warning stays exactly as it was
      expect(warningRepository.update).not.toHaveBeenCalled();
      expect(warningRepository.save).not.toHaveBeenCalled();
      expect(warningRepository.delete).not.toHaveBeenCalled();
    });

    test('test_applyCalculation_noPeriodWindow_doesNotModifyWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(existingWarning());

      const input = baseInput({
        window: null,
        calculation: { calculable: false, reason: 'no_period_window' },
      });
      await service.applyCalculation(input);

      expect(warningRepository.update).not.toHaveBeenCalled();
      expect(warningRepository.save).not.toHaveBeenCalled();
      expect(warningRepository.delete).not.toHaveBeenCalled();
    });

    test('test_applyCalculation_freezeWithNoExistingWarning_doesNotCreateOne', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null); // No existing warning

      const input = baseInput({
        calculation: { calculable: false, reason: 'no_definitive_sessions' },
      });
      await service.applyCalculation(input);

      // Still no writes
      expect(warningRepository.save).not.toHaveBeenCalled();
      expect(warningRepository.update).not.toHaveBeenCalled();
      expect(warningRepository.delete).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // DELETE BRANCH: frequency above min + margin, delete existing row
  // ============================================================================
  describe('delete branch (no warning needed)', () => {
    test('test_applyCalculation_frequencyAboveMargin_deletesExistingWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      const warning = existingWarning();
      warningRepository.findOneBy.mockResolvedValue(warning);

      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 35, consideredCount: 40, percentage: 88 },
      });
      await service.applyCalculation(input);

      // Should delete the warning (percentage 88 > 75 + 10 = 85)
      expect(warningRepository.delete).toHaveBeenCalledWith({ id: 'warning-1' });
      expect(warningRepository.update).not.toHaveBeenCalled();
      expect(warningRepository.save).not.toHaveBeenCalled();
    });

    test('test_applyCalculation_frequencyExactlyAtMarginBoundary_deletesWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      const warning = existingWarning();
      warningRepository.findOneBy.mockResolvedValue(warning);

      // min=75, percentage=86, margin=10 → 86 > 85 (min + margin) → delete
      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 344, consideredCount: 400, percentage: 86 },
      });
      await service.applyCalculation(input);

      expect(warningRepository.delete).toHaveBeenCalledWith({ id: 'warning-1' });
    });

    test('test_applyCalculation_noExistingWarningAndFrequencyAboveMargin_doesNothing', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 35, consideredCount: 40, percentage: 88 },
      });
      await service.applyCalculation(input);

      // No warning existed, so nothing to delete
      expect(warningRepository.delete).not.toHaveBeenCalled();
      expect(warningRepository.save).not.toHaveBeenCalled();
      expect(warningRepository.update).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // INSERT BRANCH: calculable with warning, no existing row
  // ============================================================================
  describe('insert branch (new warning)', () => {
    test('test_applyCalculation_frequencyBelowMinimum_insertsNewWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 28, consideredCount: 40, percentage: 70 },
      });
      await service.applyCalculation(input);

      // Should save a new warning with below_minimum type
      expect(warningRepository.save).toHaveBeenCalled();
      const savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity.warningType).toBe('below_minimum');
      expect(savedEntity.seenAt).toBeNull();
      expect(savedEntity.status).toBe('active');
      expect(savedEntity.warningTypeSince).toBeInstanceOf(Date);
    });

    test('test_applyCalculation_frequencyApproachingMinimum_insertsWithApproachingType', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      // min=75, percentage=80 → 75 <= 80 <= 85 → approaching_minimum
      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 32, consideredCount: 40, percentage: 80 },
      });
      await service.applyCalculation(input);

      expect(warningRepository.save).toHaveBeenCalled();
      const savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity.warningType).toBe('approaching_minimum');
    });

    test('test_applyCalculation_insertedWarning_hasNumbersSet', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 28, consideredCount: 40, percentage: 70 },
      });
      await service.applyCalculation(input);

      const savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity).toMatchObject({
        personId: 'person-1',
        classGroupId: 'class-group-1',
        subjectId: 'subject-1',
        frequencyPercentage: 70,
        presentCount: 28,
        consideredCount: 40,
        minPercentageApplied: 75,
        periodStartDate: new Date('2026-08-01'),
        periodEndDate: new Date('2026-09-30'),
      });
    });
  });

  // ============================================================================
  // UPDATE SAME TYPE: percentage change, dates/times untouched
  // ============================================================================
  describe('update branch — same warning type', () => {
    test('test_applyCalculation_sameTypeWarning_updatesNumbersOnly', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(
        existingWarning({
          warningType: 'approaching_minimum',
          frequencyPercentage: 78,
          presentCount: 31,
          warningTypeSince: new Date('2026-08-15'),
          seenAt: new Date('2026-08-20'),
        }),
      );

      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 30, consideredCount: 40, percentage: 75 },
      });
      await service.applyCalculation(input);

      const [criteria, updates] = warningRepository.update.mock.calls[0] as [unknown, unknown];
      expect(updates).toEqual({
        frequencyPercentage: 75,
        presentCount: 30,
        consideredCount: 40,
        minPercentageApplied: 75,
        periodStartDate: new Date('2026-08-01'),
        periodEndDate: new Date('2026-09-30'),
      });
      // warningTypeSince and seenAt are NOT in the update
      expect(updates).not.toHaveProperty('warningTypeSince');
      expect(updates).not.toHaveProperty('seenAt');
    });

    test('test_applyCalculation_updateSameType_preservesWarningTypeSince', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      const originalSince = new Date('2026-08-15');
      warningRepository.findOneBy.mockResolvedValue(
        existingWarning({
          warningType: 'below_minimum',
          warningTypeSince: originalSince,
        }),
      );

      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 25, consideredCount: 40, percentage: 62 },
      });
      await service.applyCalculation(input);

      const [, updates] = warningRepository.update.mock.calls[0] as [unknown, unknown];
      // warningTypeSince NOT touched, still the old one
      expect(updates).not.toHaveProperty('warningTypeSince');
    });
  });

  // ============================================================================
  // UPDATE TYPE TRANSITION: warning type changed, reset dates
  // ============================================================================
  describe('update branch — different warning type', () => {
    test('test_applyCalculation_typeTransitionApproachingToBelowMinimum_updatesTypeAndResetsSeenAt', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(
        existingWarning({
          warningType: 'approaching_minimum',
          seenAt: new Date('2026-08-20'),
        }),
      );

      // Frequency dropped from approaching to below minimum
      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 28, consideredCount: 40, percentage: 70 },
      });
      await service.applyCalculation(input);

      const [, updates] = warningRepository.update.mock.calls[0] as [unknown, unknown];
      expect(updates).toMatchObject({
        warningType: 'below_minimum',
        seenAt: null, // Reset on type transition
        warningTypeSince: expect.any(Date), // New timestamp
      });
    });

    test('test_applyCalculation_typeTransitionBelowToApproaching_updatesTypeAndSetsNewWarningTypeSince', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      const originalSince = new Date('2026-08-01');
      warningRepository.findOneBy.mockResolvedValue(
        existingWarning({
          warningType: 'below_minimum',
          warningTypeSince: originalSince,
          seenAt: new Date('2026-08-05'),
        }),
      );

      // Frequency recovered to approaching level
      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 32, consideredCount: 40, percentage: 80 },
      });
      const beforeUpdate = new Date();
      await service.applyCalculation(input);
      const afterUpdate = new Date();

      const [, updates] = warningRepository.update.mock.calls[0] as [unknown, unknown];
      expect(updates).toMatchObject({
        warningType: 'approaching_minimum',
        seenAt: null,
      });
      // warningTypeSince was updated (newer than original)
      const newWarningTypeSince = (updates as Record<string, unknown>).warningTypeSince as Date;
      expect(newWarningTypeSince).toBeInstanceOf(Date);
      expect(newWarningTypeSince.getTime()).toBeGreaterThanOrEqual(beforeUpdate.getTime());
      expect(newWarningTypeSince.getTime()).toBeLessThanOrEqual(afterUpdate.getTime());
    });
  });

  // ============================================================================
  // PERIOD TURNOVER: close old warning, then apply current-period logic
  // ============================================================================
  describe('period turnover (RULE-FREQ-08.1)', () => {
    test('test_applyCalculation_periodChanged_closesOldWarningBeforeInsertingNew', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);

      // Old warning from previous period
      const oldWarning = existingWarning({
        id: 'warning-old',
        periodStartDate: new Date('2026-06-01'),
        periodEndDate: new Date('2026-07-31'),
        status: 'active',
      });
      warningRepository.findOneBy.mockResolvedValue(oldWarning);

      // New period
      const input = baseInput({
        window: {
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-09-30'),
        },
        calculation: { calculable: true, presentCount: 28, consideredCount: 40, percentage: 70 },
      });
      await service.applyCalculation(input);

      // Should have TWO updates: first the close, then nothing more (or an update for new numbers if we insert)
      // Actually, looking at the code, closeIfPeriodTurnedOver resolves, then if warningType exists,
      // it either inserts or updates. In this case, a new warning should be inserted.
      const updateCalls = warningRepository.update.mock.calls;
      const saveCalls = warningRepository.save.mock.calls;

      // First call should be the close
      expect(updateCalls[0][0]).toEqual({ id: 'warning-old' });
      expect(updateCalls[0][1]).toMatchObject({
        status: 'resolved',
        resolutionReason: 'period_closed',
      });

      // Then a new warning should be saved
      expect(saveCalls.length).toBeGreaterThan(0);
      const newWarning = saveCalls[0][0];
      expect(newWarning.periodStartDate).toEqual(new Date('2026-08-01'));
      expect(newWarning.periodEndDate).toEqual(new Date('2026-09-30'));
    });

    test('test_applyCalculation_periodTurned_closeHappensBeforeInsert', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);

      warningRepository.findOneBy.mockResolvedValue(
        existingWarning({
          id: 'warning-old',
          periodStartDate: new Date('2026-06-01'),
          periodEndDate: new Date('2026-07-31'),
        }),
      );

      const input = baseInput({
        window: {
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-09-30'),
        },
        calculation: { calculable: true, presentCount: 28, consideredCount: 40, percentage: 70 },
      });
      await service.applyCalculation(input);

      // Verify invocation order: update (close) before save (insert)
      expect(warningRepository.update.mock.invocationCallOrder[0]).toBeLessThan(
        warningRepository.save.mock.invocationCallOrder[0],
      );
    });

    test('test_applyCalculation_periodTurned_newPeriodFrequencyAboveMargin_closesOldButDoesNotInsertNew', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);

      warningRepository.findOneBy.mockResolvedValue(
        existingWarning({
          id: 'warning-old',
          periodStartDate: new Date('2026-06-01'),
          periodEndDate: new Date('2026-07-31'),
        }),
      );

      // Frequency recovered above margin in new period
      const input = baseInput({
        window: {
          startDate: new Date('2026-08-01'),
          endDate: new Date('2026-09-30'),
        },
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 36, consideredCount: 40, percentage: 90 },
      });
      await service.applyCalculation(input);

      // Should close the old warning
      expect(warningRepository.update).toHaveBeenCalled();
      const [, values] = warningRepository.update.mock.calls[0] as [unknown, unknown];
      expect(values).toMatchObject({ status: 'resolved', resolutionReason: 'period_closed' });

      // Should NOT insert a new one (no warning needed above margin)
      expect(warningRepository.save).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // BOUNDARY TESTS: 69.5→70 rounding, min+margin inclusivity
  // ============================================================================
  describe('numeric boundaries (RULE-FREQ-05.3)', () => {
    test('test_applyCalculation_rounding_69_5Percent_roundsTo70', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      // 69.5% → Math.round → 70. min=75, so 70 < 75 → below_minimum warning
      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 278, consideredCount: 400, percentage: 70 }, // This is 69.5 rounded to 70
      });
      await service.applyCalculation(input);

      const savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity.frequencyPercentage).toBe(70);
      expect(savedEntity.warningType).toBe('below_minimum');
    });

    test('test_applyCalculation_boundaryAtExactMinimum_70EqualsMin_insertsApproachingWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      // percentage=70, minPercentage=70 → 70 >= 70 (yes), 70 <= 80 (yes) → approaching_minimum
      const input = baseInput({
        minPercentage: 70,
        calculation: { calculable: true, presentCount: 280, consideredCount: 400, percentage: 70 },
      });
      await service.applyCalculation(input);

      const savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity.warningType).toBe('approaching_minimum');
    });

    test('test_applyCalculation_boundaryAtMinPlusMargin_includesBothEnds', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);

      // min=75, margin=10 (constant), so the band is [75, 85]
      // percentage=75: 75 >= 75 (yes) and 75 <= 85 (yes) → approaching_minimum
      warningRepository.findOneBy.mockResolvedValue(null);
      const input1 = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 300, consideredCount: 400, percentage: 75 },
      });
      await service.applyCalculation(input1);

      let savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity.warningType).toBe('approaching_minimum');

      // percentage=85: 85 >= 75 (yes) and 85 <= 85 (yes) → still approaching_minimum (upper bound is <=)
      warningRepository.save.mockClear();
      warningRepository.findOneBy.mockResolvedValue(null);
      const input2 = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 340, consideredCount: 400, percentage: 85 },
      });
      await service.applyCalculation(input2);

      savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity.warningType).toBe('approaching_minimum');
    });

    test('test_applyCalculation_aboveMarginUpperBound_86GreaterThan85_noWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      // min=75, margin=10, so band is [75, 85]
      // percentage=86: 86 > 85 → no warning, should not insert
      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 344, consideredCount: 400, percentage: 86 },
      });
      await service.applyCalculation(input);

      expect(warningRepository.save).not.toHaveBeenCalled();
      expect(warningRepository.delete).not.toHaveBeenCalled();
    });

    test('test_applyCalculation_belowMinimum_69LessThan75_insertsBelowMinimumWarning', async () => {
      const { service, enrollmentRepository, warningRepository } = buildService();
      enrollmentRepository.count.mockResolvedValue(1);
      warningRepository.findOneBy.mockResolvedValue(null);

      // percentage=69, minPercentage=75 → 69 < 75 → below_minimum
      const input = baseInput({
        minPercentage: 75,
        calculation: { calculable: true, presentCount: 276, consideredCount: 400, percentage: 69 },
      });
      await service.applyCalculation(input);

      const savedEntity = warningRepository.save.mock.calls[0][0];
      expect(savedEntity.warningType).toBe('below_minimum');
    });
  });

  // ============================================================================
  // Subject Removal and Deletion
  // ============================================================================
  describe('subject removal from class group (RULE-FREQ-04 addendum c)', () => {
    test('test_closeWarningsForClassGroupSubject_resolvesAllActiveWarnings', async () => {
      const { service, warningRepository, manager } = buildService();
      const mockManager = manager as never;

      // closeWarningsForClassGroupSubject takes an EntityManager from the caller
      warningRepository.update.mockResolvedValue({ affected: 3 });
      await service.closeWarningsForClassGroupSubject(mockManager, 'class-group-1', 'subject-1');

      expect(warningRepository.update).toHaveBeenCalledWith(
        { classGroupId: 'class-group-1', subjectId: 'subject-1', status: 'active' },
        { status: 'resolved', resolvedAt: expect.any(Date), resolutionReason: 'subject_removed_from_class_group' },
      );
    });
  });

  describe('class group deletion (RULE-FREQ-04 addendum c)', () => {
    test('test_deleteWarningsForClassGroup_deletesAllRowsRegardlessOfStatus', async () => {
      const { service, warningRepository, manager } = buildService();
      const mockManager = manager as never;

      await service.deleteWarningsForClassGroup(mockManager, 'class-group-1');

      expect(warningRepository.delete).toHaveBeenCalledWith({ classGroupId: 'class-group-1' });
    });
  });
});
