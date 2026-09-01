import { BadRequestException, ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { InstitutionOnboardingService, OnboardInstitutionInput } from './institution-onboarding.service';

// instance_lock (AddInstanceLock migration) is the actual race-safe source
// of truth — see institution-onboarding.service.ts's top-of-file comment on
// acquireInstanceLock for why the DB itself, not a check-then-act SELECT
// COUNT, is what closes the concurrent-onboarding race (security-review
// finding). Modeled here via dataSource.query(...), switched on the SQL
// text, since there's no repository/entity for this singleton-row table.
describe('InstitutionOnboardingService', () => {
  const validInput: OnboardInstitutionInput = {
    institutionName: 'Faculdade Alfa',
    cnpj: '11.222.333/0001-81',
    institutionType: 'faculdade',
    addressZipCode: '01310-100',
    addressStreet: 'Av. Paulista',
    addressNumber: '1000',
    addressComplement: 'Sala 2',
    addressNeighborhood: 'Bela Vista',
    addressCity: 'São Paulo',
    addressState: 'sp',
    rootFullName: 'Root Admin',
    rootCpf: '11122233344',
    rootPassword: 'a strong root password',
  };

  function buildService(
    options: {
      locked?: boolean;
      acquireLockError?: unknown;
      createTenant?: jest.Mock;
    } = {},
  ) {
    const query = jest.fn(async (sql: string) => {
      if (sql.startsWith('SELECT 1 FROM instance_lock')) {
        return options.locked ? [{ exists: 1 }] : [];
      }
      if (sql.startsWith('INSERT INTO instance_lock')) {
        if (options.acquireLockError) {
          throw options.acquireLockError;
        }
        return [];
      }
      if (sql.startsWith('DELETE FROM instance_lock')) {
        return [];
      }
      throw new Error(`Unexpected query in test: ${sql}`);
    });
    const dataSource = { query };
    const tenantBootstrap = {
      createTenant:
        options.createTenant ??
        jest.fn().mockResolvedValue({
          tenantId: 'tenant-1',
          rootPersonId: 'root-person-1',
          rootPermissionGroupId: 'root-group-1',
        }),
    };

    const service = new InstitutionOnboardingService(dataSource as never, tenantBootstrap as never);
    return { service, dataSource, query, tenantBootstrap };
  }

  describe('getStatus', () => {
    test('test_getStatus_noInstanceLockRow_returnsConfiguredFalse', async () => {
      const { service } = buildService({ locked: false });

      await expect(service.getStatus()).resolves.toEqual({ configured: false });
    });

    test('test_getStatus_instanceLockRowExists_returnsConfiguredTrue', async () => {
      const { service } = buildService({ locked: true });

      await expect(service.getStatus()).resolves.toEqual({ configured: true });
    });
  });

  describe('onboard', () => {
    // RULE-INST-02: the trava de instância única — checked before anything
    // else, including CNPJ validation, so a locked instance never even
    // evaluates the rest of the payload.
    test('test_onboard_instanceAlreadyLocked_throwsConflictBeforeValidatingCnpjOrCreatingTenant', async () => {
      const { service, tenantBootstrap } = buildService({ locked: true });

      await expect(service.onboard({ ...validInput, cnpj: 'not-a-cnpj' })).rejects.toThrow(ConflictException);
      expect(tenantBootstrap.createTenant).not.toHaveBeenCalled();
    });

    // Security-review finding: the check-then-act gap between the fast-path
    // isInstanceLocked() read and tenant creation used to let two concurrent
    // requests both pass. Simulated here as the fast-path read seeing
    // "unlocked" (locked: false) but the atomic INSERT losing the race
    // anyway (a second request having already inserted the lock row a
    // moment earlier) — acquireInstanceLock must convert that unique
    // violation into the same ConflictException, without ever calling
    // createTenant.
    test('test_onboard_raceLostAtLockAcquisition_throwsConflictWithoutCreatingTenant', async () => {
      const acquireLockError = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
        driverError: { code: '23505' },
      });
      const { service, tenantBootstrap } = buildService({ locked: false, acquireLockError });

      await expect(service.onboard(validInput)).rejects.toThrow(ConflictException);
      expect(tenantBootstrap.createTenant).not.toHaveBeenCalled();
    });

    // RULE-INST-02 (second round, item #3): check-digit validation, rejected
    // before creating anything.
    test('test_onboard_invalidCnpjCheckDigit_throwsBadRequestBeforeCreatingTenant', async () => {
      const { service, tenantBootstrap } = buildService({ locked: false });

      await expect(service.onboard({ ...validInput, cnpj: '11222333000199' })).rejects.toThrow(BadRequestException);
      expect(tenantBootstrap.createTenant).not.toHaveBeenCalled();
    });

    test('test_onboard_malformedZipCode_throwsBadRequestBeforeCreatingTenant', async () => {
      const { service, tenantBootstrap } = buildService({ locked: false });

      await expect(service.onboard({ ...validInput, addressZipCode: '123' })).rejects.toThrow(BadRequestException);
      expect(tenantBootstrap.createTenant).not.toHaveBeenCalled();
    });

    test('test_onboard_validInput_acquiresLockThenDelegatesToTenantBootstrapWithNormalizedFields', async () => {
      const { service, tenantBootstrap, query } = buildService({ locked: false });

      const result = await service.onboard(validInput);

      expect(query).toHaveBeenCalledWith('INSERT INTO instance_lock DEFAULT VALUES');
      expect(tenantBootstrap.createTenant).toHaveBeenCalledWith({
        institutionName: 'Faculdade Alfa',
        institutionType: 'faculdade',
        rootFullName: 'Root Admin',
        rootCpf: '11122233344',
        rootPassword: 'a strong root password',
        cnpj: '11222333000181',
        addressStreet: 'Av. Paulista',
        addressNumber: '1000',
        addressComplement: 'Sala 2',
        addressNeighborhood: 'Bela Vista',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01310100',
      });
      expect(result).toEqual({ tenantId: 'tenant-1', rootPersonId: 'root-person-1', rootPermissionGroupId: 'root-group-1' });
    });

    test('test_onboard_unmaskedCnpjAndZipCode_acceptedAndNormalizedTheSameWay', async () => {
      const { service, tenantBootstrap } = buildService({ locked: false });

      await service.onboard({ ...validInput, cnpj: '11222333000181', addressZipCode: '01310100' });

      expect(tenantBootstrap.createTenant).toHaveBeenCalledWith(
        expect.objectContaining({ cnpj: '11222333000181', addressZipCode: '01310100' }),
      );
    });

    // Compensating cleanup: if provisioning fails AFTER the lock was
    // acquired (e.g. a duplicate CPF), the lock row must be released — or
    // this instance would be permanently locked out of onboarding with no
    // institution ever actually created.
    test('test_onboard_tenantBootstrapFailsAfterLockAcquired_releasesLockAndRethrows', async () => {
      const createTenant = jest.fn().mockRejectedValue(new ConflictException('CPF already has an account'));
      const { service, query } = buildService({ locked: false, createTenant });

      await expect(service.onboard(validInput)).rejects.toThrow('CPF already has an account');
      expect(query).toHaveBeenCalledWith('DELETE FROM instance_lock');
    });
  });
});
