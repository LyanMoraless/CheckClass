import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CourseEntity, DeviceIdentityEntity, InstitutionalMachineEntity, RoomEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { InstitutionalMachineStatus } from './institutional-machine-status.enum';
import { CreateInstitutionalMachineInput, InstitutionalMachineService } from './institutional-machine.service';

// RULE-DEV-04 (four required field groups — enforced at the DTO layer via
// class-validator, not re-tested here) / RULE-DEV-15 (Direção/Reitoria
// authority for cadastrar/editar/dar baixa, via LeadershipScopeService —
// same mechanism RULE-ATT-12 already established).
describe('InstitutionalMachineService', () => {
  const validInput: CreateInstitutionalMachineInput = {
    assetTag: 'PAT-001',
    serialNumber: 'SN-001',
    roomId: 'room-1',
    status: InstitutionalMachineStatus.ACTIVE,
    brand: 'Dell',
    model: 'Latitude',
    processor: 'i5',
    memoryDescription: '8GB',
    operatingSystem: 'Windows 11',
    courseId: 'course-1',
  };

  function buildService(options: { authorized?: boolean } = {}) {
    const identityRepo = createMockRepository({
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'device-identity-1', ...(entity as object) })),
    });
    const machineRepo = createMockRepository({
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      findOneBy: jest.fn().mockResolvedValue({ id: 'device-identity-1', ...validInput }),
    });
    const roomRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'room-1' }) });
    const courseRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'course-1' }) });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [DeviceIdentityEntity, identityRepo],
      [InstitutionalMachineEntity, machineRepo],
      [RoomEntity, roomRepo],
      [CourseEntity, courseRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);

    const leadershipScope = {
      getCourseScope: jest.fn().mockResolvedValue({ allCourses: options.authorized ?? true, courseIds: [] }),
    } as unknown as LeadershipScopeService;

    const service = new InstitutionalMachineService(tenantContext as never, leadershipScope);
    return { service, identityRepo, machineRepo, roomRepo, courseRepo, leadershipScope };
  }

  test('test_create_authorizedDirection_createsDeviceIdentityThenInstitutionalMachineSharingId', async () => {
    const { service, identityRepo, machineRepo } = buildService({ authorized: true });

    await service.create(validInput, 'direction-1');

    expect(identityRepo.save).toHaveBeenCalled();
    expect(machineRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'device-identity-1', assetTag: 'PAT-001' }));
  });

  test('test_create_notDirection_throwsForbiddenAndNeverWrites', async () => {
    const { service, identityRepo, machineRepo } = buildService({ authorized: false });

    await expect(service.create(validInput, 'professor-1')).rejects.toThrow(ForbiddenException);
    expect(identityRepo.save).not.toHaveBeenCalled();
    expect(machineRepo.save).not.toHaveBeenCalled();
  });

  test('test_create_roomNotFound_throwsNotFoundException', async () => {
    const { service, roomRepo } = buildService({ authorized: true });
    roomRepo.findOneBy.mockResolvedValue(null);

    await expect(service.create(validInput, 'direction-1')).rejects.toThrow(NotFoundException);
  });

  test('test_create_courseNotFound_throwsNotFoundException', async () => {
    const { service, courseRepo } = buildService({ authorized: true });
    courseRepo.findOneBy.mockResolvedValue(null);

    await expect(service.create(validInput, 'direction-1')).rejects.toThrow(NotFoundException);
  });

  test('test_list_notDirection_throwsForbidden', async () => {
    const { service } = buildService({ authorized: false });

    await expect(service.list('professor-1')).rejects.toThrow(ForbiddenException);
  });

  test('test_update_notDirection_throwsForbiddenAndNeverWrites', async () => {
    const { service, machineRepo } = buildService({ authorized: false });

    await expect(service.update('device-identity-1', { status: InstitutionalMachineStatus.DECOMMISSIONED }, 'professor-1')).rejects.toThrow(
      ForbiddenException,
    );
    expect(machineRepo.update).not.toHaveBeenCalled();
  });

  test('test_update_machineNotFound_throwsNotFoundException', async () => {
    const { service, machineRepo } = buildService({ authorized: true });
    machineRepo.findOneBy.mockResolvedValue(null);

    await expect(service.update('missing-machine', { status: InstitutionalMachineStatus.MAINTENANCE }, 'direction-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  test('test_update_authorizedDirection_updatesStatusForDarBaixa', async () => {
    const { service, machineRepo } = buildService({ authorized: true });

    await service.update('device-identity-1', { status: InstitutionalMachineStatus.DECOMMISSIONED }, 'direction-1');

    expect(machineRepo.update).toHaveBeenCalledWith({ id: 'device-identity-1' }, { status: InstitutionalMachineStatus.DECOMMISSIONED });
  });
});
