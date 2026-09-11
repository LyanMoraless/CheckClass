import { ConflictException, ForbiddenException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { ClassGroupEntity, ClassSessionEntity, DeviceBindingEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { DeviceCredentialService } from '../device-identity/device-credential.service';
import { InstitutionalNetworkService } from '../institutional-network/institutional-network.service';
import { CheckoutReason } from './checkout-reason.enum';
import { DeviceBindingConfigService } from './device-binding-config.service';
import { DeviceBindingService } from './device-binding.service';

const insideNetworkIp = '203.0.113.5';

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
    // GAP-10 (RULE-DEV-14): defaults to "inside the network" so every
    // pre-existing test in this file (written before GAP-10 was wired)
    // keeps exercising RULE-DEV-06/07/09 unaffected by the new check.
    withinInstitutionalNetwork?: boolean;
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

    const institutionalNetworkService = {
      isWithinInstitutionalNetwork: jest.fn().mockResolvedValue(options.withinInstitutionalNetwork ?? true),
    } as unknown as InstitutionalNetworkService;

    const service = new DeviceBindingService(tenantContext as never, deviceCredentialService, deviceBindingConfigService, institutionalNetworkService);
    return { service, bindingRepo, classGroupRepo, deviceCredentialService, deviceBindingConfigService, institutionalNetworkService };
  }

  describe('createBinding (RULE-DEV-07)', () => {
    test('test_createBinding_noActiveBinding_createsAndReturnsInactivityTimeout', async () => {
      const { service, bindingRepo } = buildService({ existingActive: null, inactivityTimeoutMinutes: 45 });

      const result = await service.createBinding('person-1', 'device-identity-1', insideNetworkIp);

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

      await expect(service.createBinding('person-1', 'device-identity-2', insideNetworkIp)).rejects.toThrow(ConflictException);
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

      await service.createBinding('person-1', 'device-identity-2', insideNetworkIp);

      expect(bindingRepo.update).toHaveBeenCalledWith(
        { id: 'existing-binding', status: 'active' },
        expect.objectContaining({ status: 'checked_out', checkoutReason: CheckoutReason.SESSION_END }),
      );
      expect(bindingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ personId: 'person-1', deviceIdentityId: 'device-identity-2' }));
    });

    // Race condition: two concurrent logins for the same person both pass the
    // defensive findOneBy check (both see no active binding), then both try
    // to INSERT — device_binding_one_active_per_person_unique is the actual
    // race-safety net, surfaced to the caller as the same ConflictException
    // as the defensive check above, never a raw 500.
    test('test_createBinding_concurrentLoginRacesUniqueIndex_catchesQueryFailedErrorAsConflict', async () => {
      const { service, bindingRepo } = buildService({ existingActive: null });
      const uniqueViolation = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
        driverError: { code: '23505' },
      });
      bindingRepo.save.mockRejectedValue(uniqueViolation);

      await expect(service.createBinding('person-1', 'device-identity-2', insideNetworkIp)).rejects.toThrow(ConflictException);
    });

    test('test_createBinding_unrelatedDbError_rethrowsAsIsWithoutWrappingAsConflict', async () => {
      const { service, bindingRepo } = buildService({ existingActive: null });
      const otherError = new Error('connection lost');
      bindingRepo.save.mockRejectedValue(otherError);

      await expect(service.createBinding('person-1', 'device-identity-2', insideNetworkIp)).rejects.toThrow('connection lost');
    });

    // GAP-10 (RULE-DEV-14) — wired this round.
    describe('institutional network check (GAP-10/RULE-DEV-14)', () => {
      test('test_createBinding_outsideInstitutionalNetwork_throwsForbiddenAndNeverWrites', async () => {
        const { service, bindingRepo, institutionalNetworkService } = buildService({
          existingActive: null,
          withinInstitutionalNetwork: false,
        });

        await expect(service.createBinding('person-1', 'device-identity-1', '198.51.100.9')).rejects.toThrow(ForbiddenException);
        expect(bindingRepo.save).not.toHaveBeenCalled();
        expect(institutionalNetworkService.isWithinInstitutionalNetwork).toHaveBeenCalledWith('tenant-a-id', '198.51.100.9');
      });

      test('test_createBinding_outsideInstitutionalNetwork_neverReachesRuleDev07CheckOrSweep', async () => {
        // The network check must be the FIRST thing createBinding does — an
        // existing active binding (RULE-DEV-07) must never be reported as
        // the rejection reason when the real reason is "outside the
        // network".
        const { service, bindingRepo } = buildService({
          existingActive: { id: 'existing-binding', personId: 'person-1', status: 'active', startedAt: new Date() },
          withinInstitutionalNetwork: false,
        });

        await expect(service.createBinding('person-1', 'device-identity-2', '198.51.100.9')).rejects.toThrow(ForbiddenException);
        expect(bindingRepo.findOneBy).not.toHaveBeenCalled();
      });

      test('test_createBinding_insideInstitutionalNetwork_passesTenantIdAndSourceIpThrough', async () => {
        const { service, institutionalNetworkService } = buildService({ existingActive: null, withinInstitutionalNetwork: true });

        await service.createBinding('person-1', 'device-identity-1', insideNetworkIp);

        expect(institutionalNetworkService.isWithinInstitutionalNetwork).toHaveBeenCalledWith('tenant-a-id', insideNetworkIp);
      });
    });
  });

  describe('completeLogin / generateLoginOptions (WebAuthn login ceremony wrapper)', () => {
    test('test_generateLoginOptions_delegatesToDeviceCredentialService', async () => {
      const { service, deviceCredentialService } = buildService({});
      (deviceCredentialService.generateAuthenticationCeremonyOptions as jest.Mock).mockResolvedValue({
        options: { challenge: 'c' },
        challengeToken: 'token-1',
      });

      const result = await service.generateLoginOptions();

      expect(result).toEqual({ options: { challenge: 'c' }, challengeToken: 'token-1' });
    });

    test('test_completeLogin_verifiesWebauthnThenCreatesBindingForResolvedDeviceIdentityId', async () => {
      // RULE-DEV-01 nota C4: deviceIdentityId comes ONLY from the verified
      // assertion's return value — never accepted as a parameter alongside
      // the WebAuthn response itself.
      const { service, bindingRepo, deviceCredentialService } = buildService({ existingActive: null });
      (deviceCredentialService.verifyAuthentication as jest.Mock).mockResolvedValue({ deviceIdentityId: 'device-identity-from-assertion' });

      await service.completeLogin('person-1', 'challenge-token-1', { id: 'cred-1' } as never, insideNetworkIp);

      expect(deviceCredentialService.verifyAuthentication).toHaveBeenCalledWith('challenge-token-1', { id: 'cred-1' });
      expect(bindingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ personId: 'person-1', deviceIdentityId: 'device-identity-from-assertion' }),
      );
    });

    test('test_completeLogin_webauthnVerificationRejects_neverCreatesBinding', async () => {
      const { service, bindingRepo, deviceCredentialService } = buildService({ existingActive: null });
      (deviceCredentialService.verifyAuthentication as jest.Mock).mockRejectedValue(new Error('invalid assertion'));

      await expect(service.completeLogin('person-1', 'bad-token', {} as never, insideNetworkIp)).rejects.toThrow('invalid assertion');
      expect(bindingRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('getActiveForPerson', () => {
    test('test_getActiveForPerson_sweepsThenReturnsActiveBinding', async () => {
      const { service, bindingRepo } = buildService({
        existingActive: { id: 'binding-1', personId: 'person-1', status: 'active', startedAt: new Date('2026-08-21T09:00:00.000Z') },
      });

      const result = await service.getActiveForPerson('person-1');

      expect(result).toEqual(expect.objectContaining({ id: 'binding-1' }));
      expect(bindingRepo.findOneBy).toHaveBeenCalledWith({ personId: 'person-1', status: 'active' });
    });

    test('test_getActiveForPerson_noActiveBinding_returnsNull', async () => {
      const { service } = buildService({ existingActive: null });

      const result = await service.getActiveForPerson('person-1');

      expect(result).toBeNull();
    });
  });

  describe('listActiveAndHistory (RULE-DEV-13/RULE-ACC-08)', () => {
    test('test_listActiveAndHistory_sweepsOnceForEachDistinctActivePersonThenReturnsFullHistoryOrdered', async () => {
      const activeRows = [
        { id: 'binding-1', personId: 'person-1', status: 'active', startedAt: new Date('2026-08-21T09:00:00.000Z') },
        { id: 'binding-2', personId: 'person-1', status: 'active', startedAt: new Date('2026-08-21T09:00:00.000Z') }, // same person twice — must dedup
        { id: 'binding-3', personId: 'person-2', status: 'active', startedAt: new Date('2026-08-21T09:00:00.000Z') },
      ];
      const { service, bindingRepo } = buildService({});
      bindingRepo.findBy.mockResolvedValue(activeRows);
      bindingRepo.find.mockResolvedValue(activeRows);
      // sweepActiveBindingForPerson's own findOneBy lookup — no active row by
      // the time the sweep runs (already swept or never had one), so the
      // sweep itself becomes a no-op for both distinct persons.
      bindingRepo.findOneBy.mockResolvedValue(null);

      const result = await service.listActiveAndHistory();

      // Deduplicated to 2 distinct personIds (person-1, person-2), not 3 sweep calls.
      expect(bindingRepo.findOneBy).toHaveBeenCalledTimes(2);
      expect(bindingRepo.findOneBy).toHaveBeenCalledWith({ personId: 'person-1', status: 'active' });
      expect(bindingRepo.findOneBy).toHaveBeenCalledWith({ personId: 'person-2', status: 'active' });
      expect(bindingRepo.find).toHaveBeenCalledWith({ order: { startedAt: 'DESC' } });
      expect(result).toBe(activeRows);
    });

    test('test_listActiveAndHistory_noActiveBindings_skipsSweepEntirelyAndReturnsHistory', async () => {
      const { service, bindingRepo } = buildService({});
      bindingRepo.findBy.mockResolvedValue([]);
      bindingRepo.find.mockResolvedValue([]);

      await service.listActiveAndHistory();

      expect(bindingRepo.findOneBy).not.toHaveBeenCalled();
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

    test('test_evaluateFactorForClassSession_noResolvableEffectiveRoomAtAll_returnsNotApplicableRatherThanThrowing', async () => {
      // Neither the session nor its class_group has a room on record — the
      // comparison has nothing to match against. RULE-DEV-09 only spells out
      // "room diverges"; a room that plain doesn't exist to compare against
      // is read here as the same non-applicable outcome, not a crash and not
      // silently counted as "present".
      const sessionWithoutRoomOverride: ClassSessionEntity = { ...pastSession, roomId: null };
      const { service, classGroupRepo } = buildService({
        evaluateRows: [{ institutional_room_id: 'room-1', is_personal_device: false }],
        classGroupRoomId: null,
      });

      const result = await service.evaluateFactorForClassSession('person-1', sessionWithoutRoomOverride);

      expect(classGroupRepo.findOneBy).toHaveBeenCalledWith({ id: 'class-group-1' });
      expect(result).toBe('not_applicable');
    });
  });
});
