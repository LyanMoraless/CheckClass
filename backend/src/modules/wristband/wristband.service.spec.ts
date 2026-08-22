import { ConflictException, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PersonEntity, WristbandCategoryEntity, WristbandEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { IssueWristbandInput, WristbandService } from './wristband.service';

// RULE-ACC-01: a wristband/tag is the holder's identity credential. Revoking
// sets status inactive (IdentificationService already filters on
// status='active') rather than deleting, so the audit trail survives.
describe('WristbandService', () => {
  const issueInput: IssueWristbandInput = {
    personId: 'person-1',
    wristbandCategoryId: 'category-1',
    tagCode: 'TAG-001',
  };

  function buildService(options: {
    personRepo?: MockRepository;
    categoryRepo?: MockRepository;
    wristbandRepo?: MockRepository;
  } = {}) {
    const personRepo = options.personRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'person-1' }) });
    const categoryRepo =
      options.categoryRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'category-1' }) });
    const wristbandRepo = options.wristbandRepo ?? createMockRepository();

    const repositoriesByEntity = new Map([
      [PersonEntity, personRepo],
      [WristbandCategoryEntity, categoryRepo],
      [WristbandEntity, wristbandRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);
    const service = new WristbandService(tenantContext as never);
    return { service, personRepo, categoryRepo, wristbandRepo };
  }

  test('test_issue_personAndCategoryExist_savesWristband', async () => {
    const { service, wristbandRepo } = buildService();

    await service.issue(issueInput);

    expect(wristbandRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-a-id', personId: 'person-1', wristbandCategoryId: 'category-1', tagCode: 'TAG-001' }),
    );
  });

  test('test_issue_personNotFound_throwsNotFound', async () => {
    const personRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ personRepo });

    await expect(service.issue(issueInput)).rejects.toThrow(NotFoundException);
  });

  test('test_issue_categoryNotFound_throwsNotFound', async () => {
    const categoryRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ categoryRepo });

    await expect(service.issue(issueInput)).rejects.toThrow(NotFoundException);
  });

  test('test_issue_duplicateTagCode_throwsConflictNotRawDbError', async () => {
    const duplicateError = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
      driverError: { code: '23505' },
    });
    const wristbandRepo = createMockRepository({ save: jest.fn().mockRejectedValue(duplicateError) });
    const { service } = buildService({ wristbandRepo });

    await expect(service.issue(issueInput)).rejects.toThrow(ConflictException);
  });

  test('test_revoke_wristbandExists_setsStatusInactive', async () => {
    const wristbandRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'wristband-1' }) });
    const { service } = buildService({ wristbandRepo });

    await service.revoke('wristband-1');

    expect(wristbandRepo.update).toHaveBeenCalledWith({ id: 'wristband-1' }, { status: 'inactive' });
  });

  test('test_revoke_wristbandNotFound_throwsNotFound', async () => {
    const wristbandRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ wristbandRepo });

    await expect(service.revoke('missing-wristband')).rejects.toThrow(NotFoundException);
  });
});
