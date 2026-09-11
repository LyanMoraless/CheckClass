import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { InstitutionalNetworkRangeEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import {
  CreateInstitutionalNetworkRangeInput,
  InstitutionalNetworkRangeService,
} from './institutional-network-range.service';

// GAP-10 (RULE-DEV-14) admin CRUD — gated by the same Direção/Reitoria
// authority as InstitutionalMachineService (RULE-DEV-15), same test
// structure as institutional-machine.service.spec.ts.
describe('InstitutionalNetworkRangeService', () => {
  const validInput: CreateInstitutionalNetworkRangeInput = { cidr: '203.0.113.0/24', label: 'Prédio principal' };

  function buildService(options: { authorized?: boolean } = {}) {
    const rangeRepo = createMockRepository({
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'range-1', ...(entity as object) })),
      findOneBy: jest.fn().mockResolvedValue({ id: 'range-1', tenantId: 'tenant-a-id', ...validInput }),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([[InstitutionalNetworkRangeEntity, rangeRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);

    const leadershipScope = {
      getCourseScope: jest.fn().mockResolvedValue({ allCourses: options.authorized ?? true, courseIds: [] }),
    } as unknown as LeadershipScopeService;

    const service = new InstitutionalNetworkRangeService(tenantContext as never, leadershipScope);
    return { service, rangeRepo, leadershipScope };
  }

  describe('create', () => {
    test('test_create_authorizedDirection_savesWithTenantIdAndCidr', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });

      await service.create(validInput, 'direction-1');

      expect(rangeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-a-id', cidr: '203.0.113.0/24', label: 'Prédio principal' }),
      );
    });

    test('test_create_notDirection_throwsForbiddenAndNeverWrites', async () => {
      const { service, rangeRepo } = buildService({ authorized: false });

      await expect(service.create(validInput, 'professor-1')).rejects.toThrow(ForbiddenException);
      expect(rangeRepo.save).not.toHaveBeenCalled();
    });

    test('test_create_malformedCidrShape_throwsBadRequestWithoutTouchingDb', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });

      await expect(service.create({ cidr: 'not-a-cidr-at-all' }, 'direction-1')).rejects.toThrow(BadRequestException);
      expect(rangeRepo.save).not.toHaveBeenCalled();
    });

    test('test_create_duplicateCidrForTenant_throwsConflictNotRawDbError', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      const uniqueViolation = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
        driverError: { code: '23505' },
      });
      rangeRepo.save.mockRejectedValue(uniqueViolation);

      await expect(service.create(validInput, 'direction-1')).rejects.toThrow(ConflictException);
    });

    // Host-bit-set network (e.g. "192.168.1.5/24") — syntactically a valid
    // CIDR string per ipaddr.js's isValidCIDR, but Postgres' native `cidr`
    // column type rejects it at write time. This is the one gap
    // assertValidCidrShape's own precheck cannot catch.
    test('test_create_hostBitsSetRejectedByNativeCidrType_throwsBadRequestNotRawDbError', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      const invalidTextRepresentation = Object.assign(new QueryFailedError('insert', [], new Error('invalid cidr value')), {
        driverError: { code: '22P02' },
      });
      rangeRepo.save.mockRejectedValue(invalidTextRepresentation);

      await expect(service.create({ cidr: '192.168.1.5/24' }, 'direction-1')).rejects.toThrow(BadRequestException);
    });

    test('test_create_unrelatedDbError_rethrowsAsIsWithoutWrapping', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      rangeRepo.save.mockRejectedValue(new Error('connection lost'));

      await expect(service.create(validInput, 'direction-1')).rejects.toThrow('connection lost');
    });
  });

  describe('list', () => {
    test('test_list_notDirection_throwsForbidden', async () => {
      const { service } = buildService({ authorized: false });

      await expect(service.list('professor-1')).rejects.toThrow(ForbiddenException);
    });

    test('test_list_authorizedDirection_returnsOrderedRanges', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      rangeRepo.find.mockResolvedValue([{ id: 'range-1' }, { id: 'range-2' }]);

      const result = await service.list('direction-1');

      expect(rangeRepo.find).toHaveBeenCalledWith({ order: { createdAt: 'ASC' } });
      expect(result).toEqual([{ id: 'range-1' }, { id: 'range-2' }]);
    });
  });

  describe('get', () => {
    test('test_get_authorizedDirectionRangeExists_returnsRange', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });

      const result = await service.get('range-1', 'direction-1');

      expect(rangeRepo.findOneBy).toHaveBeenCalledWith({ id: 'range-1' });
      expect(result).toEqual(expect.objectContaining({ id: 'range-1' }));
    });

    test('test_get_rangeNotFound_throwsNotFoundException', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      rangeRepo.findOneBy.mockResolvedValue(null);

      await expect(service.get('missing-range', 'direction-1')).rejects.toThrow(NotFoundException);
    });

    test('test_get_notDirection_throwsForbidden', async () => {
      const { service } = buildService({ authorized: false });

      await expect(service.get('range-1', 'professor-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    test('test_update_notDirection_throwsForbiddenAndNeverWrites', async () => {
      const { service, rangeRepo } = buildService({ authorized: false });

      await expect(service.update('range-1', { label: 'Anexo' }, 'professor-1')).rejects.toThrow(ForbiddenException);
      expect(rangeRepo.update).not.toHaveBeenCalled();
    });

    test('test_update_rangeNotFound_throwsNotFoundException', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      rangeRepo.findOneBy.mockResolvedValue(null);

      await expect(service.update('missing-range', { label: 'Anexo' }, 'direction-1')).rejects.toThrow(NotFoundException);
    });

    test('test_update_authorizedDirection_updatesLabelOnly', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });

      await service.update('range-1', { label: 'Anexo' }, 'direction-1');

      expect(rangeRepo.update).toHaveBeenCalledWith({ id: 'range-1' }, { label: 'Anexo' });
    });

    test('test_update_newCidrIsMalformed_throwsBadRequestWithoutWriting', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });

      await expect(service.update('range-1', { cidr: 'garbage' }, 'direction-1')).rejects.toThrow(BadRequestException);
      expect(rangeRepo.update).not.toHaveBeenCalled();
    });

    test('test_update_partialUpdateWithoutCidr_skipsCidrShapeCheck', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });

      await service.update('range-1', { label: 'Anexo' }, 'direction-1');

      expect(rangeRepo.update).toHaveBeenCalledWith({ id: 'range-1' }, { label: 'Anexo' });
    });

    test('test_update_duplicateCidrAgainstAnotherRange_throwsConflict', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      const uniqueViolation = Object.assign(new QueryFailedError('update', [], new Error('duplicate key')), {
        driverError: { code: '23505' },
      });
      rangeRepo.update.mockRejectedValue(uniqueViolation);

      await expect(service.update('range-1', { cidr: '198.51.100.0/24' }, 'direction-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    test('test_remove_notDirection_throwsForbiddenAndNeverDeletes', async () => {
      const { service, rangeRepo } = buildService({ authorized: false });

      await expect(service.remove('range-1', 'professor-1')).rejects.toThrow(ForbiddenException);
      expect(rangeRepo.delete).not.toHaveBeenCalled();
    });

    test('test_remove_rangeNotFound_throwsNotFoundException', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });
      rangeRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove('missing-range', 'direction-1')).rejects.toThrow(NotFoundException);
    });

    test('test_remove_authorizedDirection_deletesById', async () => {
      const { service, rangeRepo } = buildService({ authorized: true });

      await service.remove('range-1', 'direction-1');

      expect(rangeRepo.delete).toHaveBeenCalledWith({ id: 'range-1' });
    });
  });
});
