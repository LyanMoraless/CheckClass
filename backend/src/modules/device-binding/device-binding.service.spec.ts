import { ConflictException } from '@nestjs/common';
import { ClassGroupEntity, ClassSessionEntity, DeviceBindingEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { DeviceCredentialService } from '../device-identity/device-credential.service';
import { CheckoutReason } from './checkout-reason.enum';
import { DeviceBindingConfigService } from './device-binding-config.service';
import { DeviceBindingService } from './device-binding.service';

const pastSession: ClassSessionEntity = {
  id: 'session-1',
  tenantId: 'tenant-a-id',
  classGroupId: 'class-group-1',
  subjectId: 'subject-1',
  roomId: 'room-1',
  scheduledStart: new Date('2026-08-21T10:00:00.000Z'),
  scheduledEnd: new Date('2026-08-21T12:00:00.000Z'),
  status: 'scheduled',
  minAttendancePercentageSnapshot: 75 as never,
  toleranceMinutesSnapshot: 20,
  postToleranceBehaviorSnapshot: 'register_only',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// RULE-DEV-06 (idempotent checkout, four triggers) / RULE-DEV-07 (one active
// binding per person, lazy gatilho-2 safety net) / RULE-DEV-09 (three-state
// factor evaluation for the Motor de Regras).
describe('DeviceBindingService', () => {
  function buildService(options: {
    existingActive?: Partial<DeviceBindingEntity> | null;
    // Controls findClassSessionInProgressAt's result for the sweep — null
    // means "no session was in progress when the active binding started".
    sweepSession?: { id: string; scheduled_end: string } | null;
    evaluateRows?: Array<{ institutional_room_id: string | null; is_personal_device: boolean }>;
    classGroupRoomId?: string | null;
    inactivityTimeoutMinutes?: number;
  }) {
    const bindingRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.existingActive ?? null),
      findBy: jest.fn().mockResolvedValue(options.existingActive ? [options.existingActive] : []),
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'binding-1', ...(entity as object) })),
      find: jest.fn().mockResolvedValue([]),
    });
    const classGroupRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.classGroupRoomId !== undefined ? { id: 'class-group-1', roomId: options.classGroupRoomId } : null),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [DeviceBindingEntity, bindingRepo],
      [ClassGroupEntity, classGroupRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    manager.query.mockImplementation((sql: string) => {
      if (sql.includes('class_group_enrollment')) {
        return Promise.resolve(options.sweepSession ? [options.sweepSession] : []);
      }
      if (sql.includes('FROM device_binding')) {
        return Promise.resolve(options.evaluateRows ?? []);
      }
      return Promise.resolve([]);
    });
    const tenantContext = createMockTenantContext(manager);

    const deviceCredentialService = {
      verifyAuthentication: jest.fn(),
      generateAuthenticationCeremonyOptions: jest.fn(),
    } as unknown as DeviceCredentialService;

    const deviceBindingConfigService = {
      getEffective: jest.fn().mockResolvedValue({ inactivityTimeoutMinutes: options.inactivityTimeoutMinutes ?? 30, isDefault: false }),
    } as unknown as DeviceBindingConfigService;

    const service = new DeviceBindingService(tenantContext as never, deviceCredentialService, deviceBindingConfigService);
    return { service, bindingRepo, classGroupRepo, deviceCredentialService, deviceBindingConfigService };
  }

  describe('createBinding (RULE-DEV-07)', () => {
    test('test_createBinding_noActiveBinding_createsAndReturnsInactivityTimeout', async () => {
      const { service, bindingRepo } = buildService({ existingActive: null, inactivityTimeoutMinutes: 45 });

      const result = await service.createBinding('person-1', 'device-identity-1');

      expect(bindingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ personId: 'person-1', deviceIdentityId: 'device-identity-1', status: 'active' }),
      );
      expect(result.inactivityTimeoutMinutes).toBe(45);
    });

    test('test_createBinding_activeBindingStillActiveAfterSweep_throwsConflict', async () => {
      const { service, bindingRepo } = buildService({
        existingActive: { id: 'existing-binding', personId: 'person-1', status: 'active', startedAt: new Date('2026-08-21T09:00:00.000Z') },
        sweepSession: null, // no session tied to it -> gatilho 2 never applies -> stays active
      });

      await expect(service.createBinding('person-1', 'device-identity-2')).rejects.toThrow(ConflictException);
      expect(bindingRepo.save).not.toHaveBeenCalled();
    });

    test('test_createBinding_activeBindingSessionAlreadyEnded_sweepsItFreeAndCreatesNewOne', async () => {
      // Gatilho 2, lazy: the binding's own session ended in the past, so the
      // safety net checks it out BEFORE the RULE-DEV-07 check runs.
      const { service, bindingRepo } = buildService({
        existingActive: { id: 'existing-binding', personId: 'person-1', status: 'active', startedAt: new Date('2020-01-01T09:00:00.000Z') },
        sweepSession: { id: 'old-session', scheduled_end: '2020-01-01T10:00:00.000Z' },
      });
      // After the sweep's checkout, a fresh findOneBy for RULE-DEV-07's own
      // check should see no active binding — simulate that by making the mock
      // return the active row only once (the sweep's own lookup).
      let call = 0;
      bindingRepo.findOneBy.mockImplementation(() => {
        call += 1;
        return Promise.resolve(call === 1 ? { id: 'existing-binding', personId: 'person-1', status: 'active', startedAt: new Date('2020-01-01T09:00:00.000Z') } : null);
      });

      await service.createBinding('person-1', 'device-identity-2');

      expect(bindingRepo.update).toHaveBeenCalledWith(
        { id: 'existing-binding', status: 'active' },
        expect.objectContaining({ status: 'checked_out', checkoutReason: CheckoutReason.SESSION_END }),
      );
      expect(bindingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ personId: 'person-1', deviceIdentityId: 'device-identity-2' }));
    });
  });

  describe('checkout (RULE-DEV-06, idempotent)', () => {
    test('test_checkout_updatesOnlyWhenStatusIsActive', async () => {
      const { service, bindingRepo } = buildService({});

      await service.checkout('binding-1', CheckoutReason.LOGOUT, new Date('2026-08-21T11:00:00.000Z'));

      expect(bindingRepo.update).toHaveBeenCalledWith(
        { id: 'binding-1', status: 'active' },
        { status: 'checked_out', checkedOutAt: new Date('2026-08-21T11:00:00.000Z'), checkoutReason: CheckoutReason.LOGOUT },
      );
    });
  });

  describe('checkoutMine', () => {
    test('test_checkoutMine_noActiveBinding_returnsCheckedOutFalseWithoutUpdating', async () => {
      const { service, bindingRepo } = buildService({ existingActive: null });

      const result = await service.checkoutMine('person-1', CheckoutReason.INACTIVITY_TIMEOUT);

      expect(result).toEqual({ checkedOut: false });
      expect(bindingRepo.update).not.toHaveBeenCalled();
    });

    test('test_checkoutMine_activeBinding_checksOutAndReturnsTrue', async () => {
      const { service, bindingRepo } = buildService({ existingActive: { id: 'binding-1', personId: 'person-1', status: 'active' } });

      const result = await service.checkoutMine('person-1', CheckoutReason.TOKEN_EXPIRED);

      expect(result).toEqual({ checkedOut: true });
      expect(bindingRepo.update).toHaveBeenCalledWith(
        { id: 'binding-1', status: 'active' },
        expect.objectContaining({ checkoutReason: CheckoutReason.TOKEN_EXPIRED }),
      );
    });
  });

  describe('evaluateFactorForClassSession (RULE-DEV-09)', () => {
    test('test_evaluateFactorForClassSession_noOverlappingBinding_returnsAbsent', async () => {
      const { service } = buildService({ evaluateRows: [] });

      const result = await service.evaluateFactorForClassSession('person-1', pastSession);

      expect(result).toBe('absent');
    });

    test('test_evaluateFactorForClassSession_personalDevice_alwaysPresentNoRoomCheck', async () => {
      const { service } = buildService({ evaluateRows: [{ institutional_room_id: null, is_personal_device: true }] });

      const result = await service.evaluateFactorForClassSession('person-1', pastSession);

      expect(result).toBe('present');
    });

    test('test_evaluateFactorForClassSession_institutionalMachineRoomMatchesSession_returnsPresent', async () => {
      const { service } = buildService({ evaluateRows: [{ institutional_room_id: 'room-1', is_personal_device: false }] });

      const result = await service.evaluateFactorForClassSession('person-1', pastSession);

      expect(result).toBe('present');
    });

    test('test_evaluateFactorForClassSession_institutionalMachineRoomDivergesFromSession_returnsNotApplicable', async () => {
      const { service } = buildService({ evaluateRows: [{ institutional_room_id: 'room-99', is_personal_device: false }] });

      const result = await service.evaluateFactorForClassSession('person-1', pastSession);

      expect(result).toBe('not_applicable');
    });

    test('test_evaluateFactorForClassSession_institutionalMachineSessionRoomInheritedFromClassGroup_comparesEffectiveRoom', async () => {
      const sessionWithoutRoomOverride: ClassSessionEntity = { ...pastSession, roomId: null };
      const { service, classGroupRepo } = buildService({
        evaluateRows: [{ institutional_room_id: 'room-42', is_personal_device: false }],
        classGroupRoomId: 'room-42',
      });

      const result = await service.evaluateFactorForClassSession('person-1', sessionWithoutRoomOverride);

      expect(classGroupRepo.findOneBy).toHaveBeenCalledWith({ id: 'class-group-1' });
      expect(result).toBe('present');
    });
  });
});
