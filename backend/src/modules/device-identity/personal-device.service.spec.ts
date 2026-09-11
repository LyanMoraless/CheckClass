import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { DeviceIdentityEntity, PersonalDeviceEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { PersonalDeviceService } from './personal-device.service';

// RULE-DEV-02 (self-service BYOD) / RULE-DEV-17 (one active per person) /
// RULE-DEV-18 (revoked by the owner OR Direção/Reitoria).
describe('PersonalDeviceService', () => {
  function buildService(options: { existingActive?: unknown; isDirection?: boolean } = {}) {
    const identityRepo = createMockRepository({
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'device-identity-1', ...(entity as object) })),
    });
    const deviceRepo = createMockRepository({
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOneBy: jest.fn().mockResolvedValue(options.existingActive ?? null),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [DeviceIdentityEntity, identityRepo],
      [PersonalDeviceEntity, deviceRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);

    const leadershipScope = {
      getCourseScope: jest.fn().mockResolvedValue({ allCourses: options.isDirection ?? false, courseIds: [] }),
    } as unknown as LeadershipScopeService;

    const service = new PersonalDeviceService(tenantContext as never, leadershipScope);
    return { service, identityRepo, deviceRepo, leadershipScope };
  }

  test('test_register_noExistingActiveDevice_createsDeviceIdentityAndPersonalDevice', async () => {
    const { service, identityRepo, deviceRepo } = buildService({ existingActive: null });

    await service.register('person-1', 'My laptop');

    expect(identityRepo.save).toHaveBeenCalled();
    expect(deviceRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'device-identity-1', personId: 'person-1', label: 'My laptop', revokedAt: null }),
    );
  });

  test('test_register_alreadyHasActiveDevice_throwsConflictAndNeverWrites', async () => {
    const { service, identityRepo, deviceRepo } = buildService({ existingActive: { id: 'existing-device' } });

    await expect(service.register('person-1', null)).rejects.toThrow(ConflictException);
    expect(identityRepo.save).not.toHaveBeenCalled();
    expect(deviceRepo.save).not.toHaveBeenCalled();
  });

  // RULE-DEV-17 race: two concurrent self-registrations for the same person
  // both pass the defensive findOneBy check — personal_device_one_active_
  // per_person_unique (AddDeviceBinding migration) is the actual safety net,
  // surfaced here as the same ConflictException, never a raw 500.
  test('test_register_concurrentRegistrationRacesUniqueIndex_throwsConflictNotRawDbError', async () => {
    const { service, deviceRepo } = buildService({ existingActive: null });
    const uniqueViolation = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
      driverError: { code: '23505' },
    });
    deviceRepo.save.mockRejectedValue(uniqueViolation);

    await expect(service.register('person-1', null)).rejects.toThrow(ConflictException);
  });

  test('test_register_unrelatedDbError_rethrowsAsIsWithoutWrappingAsConflict', async () => {
    const { service, deviceRepo } = buildService({ existingActive: null });
    deviceRepo.save.mockRejectedValue(new Error('connection lost'));

    await expect(service.register('person-1', null)).rejects.toThrow('connection lost');
  });

  test('test_getMine_hasActiveDevice_returnsIt', async () => {
    const { service, deviceRepo } = buildService();
    deviceRepo.findOneBy.mockResolvedValue({ id: 'device-1', personId: 'person-1', revokedAt: null });

    const result = await service.getMine('person-1');

    expect(result).toEqual(expect.objectContaining({ id: 'device-1' }));
  });

  test('test_getMine_noActiveDevice_returnsNull', async () => {
    const { service, deviceRepo } = buildService();
    deviceRepo.findOneBy.mockResolvedValue(null);

    const result = await service.getMine('person-1');

    expect(result).toBeNull();
  });

  test('test_revoke_deviceNotFound_throwsNotFoundException', async () => {
    const { service, deviceRepo } = buildService();
    deviceRepo.findOneBy.mockResolvedValue(null);

    await expect(service.revoke('missing-device', 'person-1')).rejects.toThrow(NotFoundException);
  });

  test('test_revoke_alreadyRevoked_isIdempotentNoOp', async () => {
    const { service, deviceRepo } = buildService();
    deviceRepo.findOneBy.mockResolvedValue({ id: 'device-1', personId: 'person-1', revokedAt: new Date() });

    await service.revoke('device-1', 'person-1');

    expect(deviceRepo.update).not.toHaveBeenCalled();
  });

  test('test_revoke_byOwner_updatesRevokedFields', async () => {
    const { service, deviceRepo } = buildService({ isDirection: false });
    deviceRepo.findOneBy.mockResolvedValue({ id: 'device-1', personId: 'person-1', revokedAt: null });

    await service.revoke('device-1', 'person-1');

    expect(deviceRepo.update).toHaveBeenCalledWith({ id: 'device-1' }, expect.objectContaining({ revokedByPersonId: 'person-1' }));
  });

  test('test_revoke_byDirection_updatesRevokedFields', async () => {
    const { service, deviceRepo } = buildService({ isDirection: true });
    deviceRepo.findOneBy.mockResolvedValue({ id: 'device-1', personId: 'owner-1', revokedAt: null });

    await service.revoke('device-1', 'direction-1');

    expect(deviceRepo.update).toHaveBeenCalledWith({ id: 'device-1' }, expect.objectContaining({ revokedByPersonId: 'direction-1' }));
  });

  test('test_revoke_neitherOwnerNorDirection_throwsForbidden', async () => {
    const { service, deviceRepo } = buildService({ isDirection: false });
    deviceRepo.findOneBy.mockResolvedValue({ id: 'device-1', personId: 'owner-1', revokedAt: null });

    await expect(service.revoke('device-1', 'random-person')).rejects.toThrow(ForbiddenException);
    expect(deviceRepo.update).not.toHaveBeenCalled();
  });
});
