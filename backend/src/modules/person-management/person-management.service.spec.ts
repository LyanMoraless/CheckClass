import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { compare } from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { ActorTypeEntity, PersonCredentialEntity, PersonEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockInsertQueryBuilder,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { CreatePersonInput, PersonManagementService } from './person-management.service';

// Minimal "manage users" capability behind MANAGE_USERS (confirmed
// 2026-08-22): find-or-create actor_type by code (insert-or-ignore against
// the UNIQUE(tenant_id, code) constraint, not a racy plain find-then-create),
// then a person, then an optional credential when both cpf and password are
// supplied — never just one (that used to silently skip credential
// creation with no signal to the caller; now it's a validation error).
describe('PersonManagementService', () => {
  function buildService(
    options: {
      actorTypeRepo?: MockRepository;
      personRepo?: MockRepository;
      credentialRepo?: MockRepository;
      insertedActorTypeId?: string | null;
    } = {},
  ) {
    const actorTypeRepo =
      options.actorTypeRepo ??
      createMockRepository({
        findOneBy: jest.fn().mockResolvedValue(null),
        findOneByOrFail: jest.fn().mockResolvedValue({ id: 'new-actor-type' }),
      });
    const personRepo =
      options.personRepo ?? createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'person-1' }) });
    const credentialRepo = options.credentialRepo ?? createMockRepository();

    const repositoriesByEntity = new Map([
      [ActorTypeEntity, actorTypeRepo],
      [PersonEntity, personRepo],
      [PersonCredentialEntity, credentialRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    if ('insertedActorTypeId' in options) {
      manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(options.insertedActorTypeId ?? null));
    }
    const tenantContext = createMockTenantContext(manager);
    const retroactiveMinorConsentGuard = { suspendSensitiveConsentsIfGranted: jest.fn().mockResolvedValue(undefined) };
    const service = new PersonManagementService(tenantContext as never, retroactiveMinorConsentGuard as never);
    return { service, actorTypeRepo, personRepo, credentialRepo, manager, retroactiveMinorConsentGuard };
  }

  const baseInput: CreatePersonInput = { fullName: 'Jane Student', actorTypeCode: 'STUDENT' };

  test('test_createPerson_existingActorTypeFound_reusesItWithoutInserting', async () => {
    const actorTypeRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'existing-actor-type', code: 'STUDENT' }),
    });
    const { service, personRepo, manager } = buildService({ actorTypeRepo });

    await service.createPerson(baseInput);

    expect(actorTypeRepo.findOneBy).toHaveBeenCalledWith({ code: 'STUDENT' });
    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(personRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a-id', actorTypeId: 'existing-actor-type', fullName: 'Jane Student' }),
    );
  });

  test('test_createPerson_noActorTypeFound_insertsNewActorTypeAndReusesInsertedId', async () => {
    const { service, personRepo, actorTypeRepo } = buildService({ insertedActorTypeId: 'new-actor-type' });

    await service.createPerson(baseInput);

    expect(actorTypeRepo.findOneByOrFail).toHaveBeenCalledWith({ id: 'new-actor-type' });
    expect(personRepo.save).toHaveBeenCalledWith(expect.objectContaining({ actorTypeId: 'new-actor-type' }));
  });

  test('test_createPerson_actorTypeInsertLosesRace_reselectsByCode', async () => {
    // Concurrent request won the race and inserted first — orIgnore leaves
    // no id on our side; must re-select by code instead of erroring or
    // creating a duplicate.
    const actorTypeRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(null),
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'concurrently-inserted' }),
    });
    const { service, personRepo } = buildService({ actorTypeRepo, insertedActorTypeId: null });

    await service.createPerson(baseInput);

    expect(actorTypeRepo.findOneByOrFail).toHaveBeenCalledWith({ code: 'STUDENT' });
    expect(personRepo.save).toHaveBeenCalledWith(expect.objectContaining({ actorTypeId: 'concurrently-inserted' }));
  });

  test('test_createPerson_cpfAndPasswordBothProvided_createsCredentialWithHashedPassword', async () => {
    const { service, credentialRepo } = buildService();

    await service.createPerson({ ...baseInput, cpf: '11122233344', password: 'a real password' });

    expect(credentialRepo.save).toHaveBeenCalledTimes(1);
    const savedCredential = credentialRepo.save.mock.calls[0][0];
    expect(savedCredential).toMatchObject({ tenantId: 'tenant-a-id', personId: 'person-1', cpf: '11122233344' });
    expect(savedCredential.passwordHash).not.toBe('a real password');
    await expect(compare('a real password', savedCredential.passwordHash)).resolves.toBe(true);
  });

  test('test_createPerson_neitherCpfNorPasswordProvided_doesNotCreateCredential', async () => {
    const { service, credentialRepo } = buildService();

    await service.createPerson(baseInput);

    expect(credentialRepo.save).not.toHaveBeenCalled();
  });

  test('test_createPerson_onlyCpfWithoutPassword_throwsBadRequest', async () => {
    const { service } = buildService();

    await expect(service.createPerson({ ...baseInput, cpf: '11122233344' })).rejects.toThrow(BadRequestException);
  });

  test('test_createPerson_onlyPasswordWithoutCpf_throwsBadRequest', async () => {
    const { service } = buildService();

    await expect(service.createPerson({ ...baseInput, password: 'a real password' })).rejects.toThrow(
      BadRequestException,
    );
  });

  test('test_createPerson_duplicateCpf_throwsConflictNotRawDbError', async () => {
    // Security review finding: this used to fall through to an unhandled
    // 500, which also doubled as a cross-tenant enumeration side-channel.
    const duplicateCpfError = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
      driverError: { code: '23505' },
    });
    const credentialRepo = createMockRepository({ save: jest.fn().mockRejectedValue(duplicateCpfError) });
    const { service } = buildService({ credentialRepo });

    await expect(service.createPerson({ ...baseInput, cpf: '11122233344', password: 'a real password' })).rejects.toThrow(
      ConflictException,
    );
  });

  test('test_createPerson_returnsPersonIdAndActorTypeId', async () => {
    const actorTypeRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'actor-type-1' }),
    });
    const personRepo = createMockRepository({ save: jest.fn().mockResolvedValue({ id: 'person-9' }) });
    const { service } = buildService({ actorTypeRepo, personRepo });

    const result = await service.createPerson(baseInput);

    expect(result).toEqual({ personId: 'person-9', actorTypeId: 'actor-type-1' });
  });

  test('test_list_returnsPersonsFromQuery_withoutTouchingRepositories', async () => {
    const rows = [
      { personId: 'person-1', fullName: 'Jane Student', actorTypeCode: 'STUDENT', hasLoginCredential: false },
    ];
    const { service, manager } = buildService();
    manager.query.mockResolvedValue(rows);

    const result = await service.list();

    expect(result).toBe(rows);
    expect(manager.query).toHaveBeenCalledWith(expect.stringContaining('FROM person p'));
  });

  test('test_list_noPersons_returnsEmptyArray', async () => {
    const { service, manager } = buildService();
    manager.query.mockResolvedValue([]);

    const result = await service.list();

    expect(result).toEqual([]);
  });

  // RULE-GRD-05/07 — Secretaria-restricted date-of-birth read/write and its
  // RULE-GRD-07 pendência 1 retroactive-risk side effect.
  describe('getDateOfBirthDetail', () => {
    test('test_getDateOfBirthDetail_personNotFound_throwsNotFound', async () => {
      const personRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ personRepo });

      await expect(service.getDateOfBirthDetail('missing-person')).rejects.toThrow(NotFoundException);
    });

    test('test_getDateOfBirthDetail_absentState_returnsNullDateOfBirthAndAbsentState', async () => {
      const personRepo = createMockRepository({
        findOneBy: jest
          .fn()
          .mockResolvedValue({ id: 'person-1', dateOfBirth: null, dateOfBirthConfirmedAt: null, dateOfBirthConfirmedByPersonId: null }),
      });
      const { service } = buildService({ personRepo });

      const result = await service.getDateOfBirthDetail('person-1');

      expect(result).toEqual({
        personId: 'person-1',
        dateOfBirth: null,
        confirmedAt: null,
        confirmedByPersonId: null,
        confirmationState: 'absent',
      });
    });

    test('test_getDateOfBirthDetail_confirmedState_passesThroughRawFields', async () => {
      const confirmedAt = new Date('2026-01-01T00:00:00.000Z');
      const personRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({
          id: 'person-1',
          dateOfBirth: '2000-05-10',
          dateOfBirthConfirmedAt: confirmedAt,
          dateOfBirthConfirmedByPersonId: 'staff-1',
        }),
      });
      const { service } = buildService({ personRepo });

      const result = await service.getDateOfBirthDetail('person-1');

      expect(result).toEqual({
        personId: 'person-1',
        dateOfBirth: '2000-05-10',
        confirmedAt,
        confirmedByPersonId: 'staff-1',
        confirmationState: 'confirmed',
      });
    });
  });

  describe('confirmDateOfBirth', () => {
    test('test_confirmDateOfBirth_personNotFound_throwsNotFound', async () => {
      const personRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ personRepo });

      await expect(service.confirmDateOfBirth('missing-person', '2000-01-01', 'staff-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    test('test_confirmDateOfBirth_adultResult_updatesPersonAndDoesNotTriggerRetroactiveGuard', async () => {
      const personRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'person-1' }),
      });
      const { service, personRepo: repo, retroactiveMinorConsentGuard } = buildService({ personRepo });

      // Comfortably an adult regardless of when this test runs.
      const result = await service.confirmDateOfBirth('person-1', '1950-01-01', 'staff-1');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'person-1' },
        expect.objectContaining({
          dateOfBirth: new Date('1950-01-01'),
          dateOfBirthConfirmedByPersonId: 'staff-1',
        }),
      );
      expect(result).toMatchObject({ personId: 'person-1', dateOfBirth: '1950-01-01', confirmedByPersonId: 'staff-1' });
      expect(retroactiveMinorConsentGuard.suspendSensitiveConsentsIfGranted).not.toHaveBeenCalled();
    });

    test('test_confirmDateOfBirth_minorResult_triggersRetroactiveGuard', async () => {
      const personRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'person-1' }),
      });
      const { service, retroactiveMinorConsentGuard } = buildService({ personRepo });

      // A birth date one year ago is comfortably a minor regardless of when
      // this test runs.
      const oneYearAgo = new Date();
      oneYearAgo.setUTCFullYear(oneYearAgo.getUTCFullYear() - 1);
      const recentDateOfBirth = oneYearAgo.toISOString().slice(0, 10);

      await service.confirmDateOfBirth('person-1', recentDateOfBirth, 'staff-1');

      expect(retroactiveMinorConsentGuard.suspendSensitiveConsentsIfGranted).toHaveBeenCalledWith('person-1', 'staff-1');
    });
  });
});
