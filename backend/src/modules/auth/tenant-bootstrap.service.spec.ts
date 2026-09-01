import { ConflictException } from '@nestjs/common';
import { compare } from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import {
  ActorTypeEntity,
  LeadershipAssignmentEntity,
  LeadershipRoleEntity,
  PersonCredentialEntity,
  PersonEntity,
  TenantEntity,
} from '../../database/entities';
import { createMockEntityManager, createMockRepository, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { Permission } from './permission.enum';
import { CreateTenantInput, TenantBootstrapService } from './tenant-bootstrap.service';

// The only sanctioned way a new institution comes into being (confirmed
// 2026-08-22). Creating the tenant row happens outside any tenant context
// (dataSource.getRepository), everything else inside
// tenantContext.runWithTenant (manager.getRepository).
describe('TenantBootstrapService', () => {
  const input: CreateTenantInput = {
    institutionName: 'Colegio Alfa',
    institutionType: 'SCHOOL',
    rootFullName: 'Root Admin',
    rootCpf: '11122233344',
    rootPassword: 'a strong root password',
  };

  function buildService(
    options: {
      tenantRepo?: MockRepository;
      personRepo?: MockRepository;
      credentialRepo?: MockRepository;
      leadershipRoleRepo?: MockRepository;
      leadershipAssignmentRepo?: MockRepository;
      rootGroup?: { id: string };
    } = {},
  ) {
    const tenantRepo =
      options.tenantRepo ?? createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'tenant-1' }) });
    const dataSource = { getRepository: jest.fn().mockReturnValue(tenantRepo) };

    const actorTypeRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'actor-type-1' }) });
    const personRepo =
      options.personRepo ?? createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'root-person-1' }) });
    const credentialRepo = options.credentialRepo ?? createMockRepository();
    // Simulates TypeORM assigning an id per row on a bulk save() of the 3
    // seeded leadership_role rows — id derived from name so assertions don't
    // depend on array order.
    const leadershipRoleRepo =
      options.leadershipRoleRepo ??
      createMockRepository({
        save: jest.fn((rows: Array<{ name: string; rank: number }>) =>
          Promise.resolve(rows.map((row) => ({ ...row, id: `leadership-role-${row.name}` }))),
        ),
      });
    const leadershipAssignmentRepo = options.leadershipAssignmentRepo ?? createMockRepository();
    const repositoriesByEntity = new Map([
      [ActorTypeEntity, actorTypeRepo],
      [PersonEntity, personRepo],
      [PersonCredentialEntity, credentialRepo],
      [LeadershipRoleEntity, leadershipRoleRepo],
      [LeadershipAssignmentEntity, leadershipAssignmentRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);

    // Mirrors real TenantContextService.runWithTenant's contract (runs the
    // callback and returns its result) without needing AsyncLocalStorage or
    // a real transaction — the same seam every other spec in this codebase
    // mocks via TenantContextService.
    const tenantContext = {
      runWithTenant: jest.fn((_tenantId: string, callback: () => Promise<unknown>) => callback()),
      getManager: jest.fn().mockReturnValue(manager),
      getTenantId: jest.fn().mockReturnValue('tenant-1'),
    };

    const rootGroup = options.rootGroup ?? { id: 'root-group-1' };
    const permissionGroupService = {
      createGroup: jest.fn().mockResolvedValue(rootGroup),
      assignPersonToGroup: jest.fn().mockResolvedValue(undefined),
    };

    const service = new TenantBootstrapService(dataSource as never, tenantContext as never, permissionGroupService as never);
    return {
      service,
      dataSource,
      tenantRepo,
      actorTypeRepo,
      personRepo,
      credentialRepo,
      leadershipRoleRepo,
      leadershipAssignmentRepo,
      tenantContext,
      permissionGroupService,
    };
  }

  test('test_createTenant_savesTenantRowOutsideTenantContextThenRunsRestWithinIt', async () => {
    const { service, dataSource, tenantRepo, tenantContext } = buildService();

    await service.createTenant(input);

    expect(dataSource.getRepository).toHaveBeenCalledWith(TenantEntity);
    expect(tenantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ name: input.institutionName, institutionType: input.institutionType }),
    );
    expect(tenantContext.runWithTenant).toHaveBeenCalledWith('tenant-1', expect.any(Function));
  });

  // RULE-INST-02: the public onboarding controller (institution-onboarding
  // module) supplies CNPJ/address on top of the CLI-only fields above; the
  // pre-existing tenant-create.ts CLI path doesn't, so these stay optional
  // on CreateTenantInput (see the interface's own comment) and simply aren't
  // passed when absent — covered by the base `input` fixture above having
  // none of them and still saving successfully.
  test('test_createTenant_withCnpjAndAddressFields_persistsThemOnTenantRow', async () => {
    const { service, tenantRepo } = buildService();
    const inputWithAddress: CreateTenantInput = {
      ...input,
      cnpj: '11222333000181',
      addressStreet: 'Rua Exemplo',
      addressNumber: '100',
      addressComplement: 'Sala 2',
      addressNeighborhood: 'Centro',
      addressCity: 'São Paulo',
      addressState: 'SP',
      addressZipCode: '01310100',
    };

    await service.createTenant(inputWithAddress);

    expect(tenantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cnpj: '11222333000181',
        addressStreet: 'Rua Exemplo',
        addressNumber: '100',
        addressComplement: 'Sala 2',
        addressNeighborhood: 'Centro',
        addressCity: 'São Paulo',
        addressState: 'SP',
        addressZipCode: '01310100',
      }),
    );
  });

  test('test_createTenant_withoutCnpjAndAddressFields_savesThemAsNull', async () => {
    const { service, tenantRepo } = buildService();

    await service.createTenant(input);

    expect(tenantRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        cnpj: null,
        addressStreet: null,
        addressNumber: null,
        addressComplement: null,
        addressNeighborhood: null,
        addressCity: null,
        addressState: null,
        addressZipCode: null,
      }),
    );
  });

  test('test_createTenant_createsAdminActorTypeAndRootPerson', async () => {
    const { service, actorTypeRepo, personRepo } = buildService();

    await service.createTenant(input);

    expect(actorTypeRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', code: 'ADMIN', name: 'Administrator' }),
    );
    expect(personRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', actorTypeId: 'actor-type-1', fullName: input.rootFullName }),
    );
  });

  test('test_createTenant_createsCredentialWithHashedPasswordNotRawPassword', async () => {
    const { service, credentialRepo } = buildService();

    await service.createTenant(input);

    expect(credentialRepo.save).toHaveBeenCalledTimes(1);
    const savedCredential = credentialRepo.save.mock.calls[0][0];
    expect(savedCredential).toMatchObject({ tenantId: 'tenant-1', personId: 'root-person-1', cpf: input.rootCpf });
    expect(savedCredential.passwordHash).not.toBe(input.rootPassword);
    await expect(compare(input.rootPassword, savedCredential.passwordHash)).resolves.toBe(true);
  });

  test('test_createTenant_createsRootPermissionGroupWithEveryPermissionAndAssignsRootPerson', async () => {
    const { service, permissionGroupService } = buildService();

    await service.createTenant(input);

    expect(permissionGroupService.createGroup).toHaveBeenCalledWith('Root', Object.values(Permission));
    expect(permissionGroupService.assignPersonToGroup).toHaveBeenCalledWith('root-person-1', 'root-group-1');
  });

  test('test_createTenant_returnsTenantRootPersonAndRootPermissionGroupIds', async () => {
    const { service } = buildService({ rootGroup: { id: 'root-group-9' } });

    const result = await service.createTenant(input);

    expect(result).toEqual({
      tenantId: 'tenant-1',
      rootPersonId: 'root-person-1',
      rootPermissionGroupId: 'root-group-9',
    });
  });

  test('test_createTenant_innerFailureDueToDuplicateCpf_deletesOrphanedTenantAndThrowsConflict', async () => {
    // Code review finding: the tenant row is created outside runWithTenant's
    // transaction (necessarily — it has nothing to scope to yet), so it
    // isn't atomic with everything else by construction. A failure inside
    // (a duplicate CPF being the obvious one, since person_credential.cpf is
    // globally unique) must not leave a permanent orphan tenant with no
    // admin/root group and no way back in.
    const tenantRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'tenant-1' }) });
    const credentialRepo = createMockRepository({
      save: jest.fn().mockRejectedValue(
        Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
          driverError: { code: '23505' },
        }),
      ),
    });
    const { service } = buildService({ tenantRepo, credentialRepo });

    await expect(service.createTenant(input)).rejects.toThrow(ConflictException);
    expect(tenantRepo.delete).toHaveBeenCalledWith({ id: 'tenant-1' });
  });

  test('test_createTenant_innerFailureForUnrelatedReason_deletesOrphanedTenantAndRethrowsOriginalError', async () => {
    const tenantRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'tenant-1' }) });
    const personRepo = createMockRepository({ save: jest.fn().mockRejectedValue(new Error('unexpected failure')) });
    const { service } = buildService({ tenantRepo, personRepo });

    await expect(service.createTenant(input)).rejects.toThrow('unexpected failure');
    expect(tenantRepo.delete).toHaveBeenCalledWith({ id: 'tenant-1' });
  });

  // RULE-INST-01 (only "faculdade" has a defined leadership hierarchy this
  // round) + RULE-INST-09 (root admin needs a real leadership_assignment,
  // not just MANAGE_INSTITUTION_STRUCTURE, to montar/editar turma from the
  // very first login) — actors.md, "Hierarquia de liderança — Faculdade".
  describe('faculdade leadership seeding', () => {
    const faculdadeInput: CreateTenantInput = { ...input, institutionType: 'faculdade' };

    test('test_createTenant_institutionTypeFaculdade_seedsThreeLeadershipRolesWithConfirmedNamesAndRanks', async () => {
      const { service, leadershipRoleRepo } = buildService();

      await service.createTenant(faculdadeInput);

      expect(leadershipRoleRepo.save).toHaveBeenCalledWith([
        expect.objectContaining({ tenantId: 'tenant-1', name: 'Professor', rank: 1 }),
        expect.objectContaining({ tenantId: 'tenant-1', name: 'Coordenador de Curso', rank: 2 }),
        expect.objectContaining({ tenantId: 'tenant-1', name: 'Direção/Reitoria', rank: 3 }),
      ]);
    });

    test('test_createTenant_institutionTypeFaculdade_grantsRootPersonInstitutionWideDirecaoReitoriaAssignment', async () => {
      const { service, leadershipAssignmentRepo } = buildService();

      await service.createTenant(faculdadeInput);

      expect(leadershipAssignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          personId: 'root-person-1',
          leadershipRoleId: 'leadership-role-Direção/Reitoria',
          courseId: null,
          classGroupId: null,
        }),
      );
    });

    test('test_createTenant_institutionTypeFaculdade_topRoleMissingAfterSeeding_throws', async () => {
      // Defensive branch: if the seeded rows somehow don't include Direção/
      // Reitoria (e.g. a future edit typo to the static role list), the root
      // person must not silently end up without any leadership authority.
      const leadershipRoleRepo = createMockRepository({
        save: jest.fn().mockResolvedValue([{ id: 'role-1', name: 'Professor', rank: 1 }]),
      });
      const { service } = buildService({ leadershipRoleRepo });

      await expect(service.createTenant(faculdadeInput)).rejects.toThrow(/Direção\/Reitoria.*missing/);
    });

    test('test_createTenant_institutionTypeNotFaculdade_doesNotSeedAnyLeadershipRoleOrAssignment', async () => {
      const { service, leadershipRoleRepo, leadershipAssignmentRepo } = buildService();

      await service.createTenant(input); // institutionType: 'SCHOOL'

      expect(leadershipRoleRepo.save).not.toHaveBeenCalled();
      expect(leadershipAssignmentRepo.save).not.toHaveBeenCalled();
    });
  });
});
