import { ForbiddenException } from '@nestjs/common';
import { PersonEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { PersonMinorityStatusService } from './person-minority-status.service';

// RULE-GRD-01/07 gate reused (once implemented) by RULE-FACE-09/RULE-PRES-14
// — see this service's own header for why it exists ahead of either caller.
describe('PersonMinorityStatusService', () => {
  function buildService(personRepo: MockRepository) {
    const manager = createMockEntityManager(new Map([[PersonEntity, personRepo]]));
    const tenantContext = createMockTenantContext(manager);
    return new PersonMinorityStatusService(tenantContext as never);
  }

  describe('getStatus', () => {
    test('test_getStatus_absentDateOfBirth_returnsAbsentAndUnknownMinority', async () => {
      const personRepo = createMockRepository({
        findOneByOrFail: jest.fn().mockResolvedValue({ dateOfBirth: null, dateOfBirthConfirmedAt: null }),
      });
      const service = buildService(personRepo);

      await expect(service.getStatus('person-1')).resolves.toEqual({ isMinor: null, confirmationState: 'absent' });
    });

    test('test_getStatus_confirmedAdult_returnsConfirmedAndFalse', async () => {
      const personRepo = createMockRepository({
        findOneByOrFail: jest
          .fn()
          .mockResolvedValue({ dateOfBirth: '1990-01-01', dateOfBirthConfirmedAt: '2026-01-01T00:00:00.000Z' }),
      });
      const service = buildService(personRepo);

      await expect(service.getStatus('person-1')).resolves.toEqual({ isMinor: false, confirmationState: 'confirmed' });
    });
  });

  describe('assertSensitiveConsentGateOpen', () => {
    test('test_assertSensitiveConsentGateOpen_absent_throwsForbidden', async () => {
      const personRepo = createMockRepository({
        findOneByOrFail: jest.fn().mockResolvedValue({ dateOfBirth: null, dateOfBirthConfirmedAt: null }),
      });
      const service = buildService(personRepo);

      await expect(service.assertSensitiveConsentGateOpen('person-1')).rejects.toThrow(ForbiddenException);
    });

    test('test_assertSensitiveConsentGateOpen_provisional_throwsForbiddenEvenIfAdult', async () => {
      const personRepo = createMockRepository({
        findOneByOrFail: jest.fn().mockResolvedValue({ dateOfBirth: '1990-01-01', dateOfBirthConfirmedAt: null }),
      });
      const service = buildService(personRepo);

      await expect(service.assertSensitiveConsentGateOpen('person-1')).rejects.toThrow(ForbiddenException);
    });

    test('test_assertSensitiveConsentGateOpen_confirmed_resolvesWithoutThrowing', async () => {
      const personRepo = createMockRepository({
        findOneByOrFail: jest
          .fn()
          .mockResolvedValue({ dateOfBirth: '1990-01-01', dateOfBirthConfirmedAt: '2026-01-01T00:00:00.000Z' }),
      });
      const service = buildService(personRepo);

      await expect(service.assertSensitiveConsentGateOpen('person-1')).resolves.toBeUndefined();
    });
  });
});
