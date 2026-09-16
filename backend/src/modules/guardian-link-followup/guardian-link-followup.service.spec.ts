import { ConflictException, NotFoundException } from '@nestjs/common';
import { GuardianLinkFollowupEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockInsertQueryBuilder,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { GuardianLinkFollowupReason, GuardianLinkFollowupService, OpenGuardianLinkFollowupInput } from './guardian-link-followup.service';

// guardian_link_followup: idempotent open() (DB partial unique index backs
// this), resolve() as the only write path to status = 'resolved' (rejecting
// an already-resolved item), and tenant-scoped listAllOpen().
describe('GuardianLinkFollowupService', () => {
  function buildService(options: { repo?: MockRepository; insertedId?: string | null } = {}) {
    const repo = options.repo ?? createMockRepository();
    const manager = createMockEntityManager(new Map([[GuardianLinkFollowupEntity, repo]]));
    if ('insertedId' in options) {
      manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(options.insertedId ?? null));
    }
    const tenantContext = createMockTenantContext(manager);
    const service = new GuardianLinkFollowupService(tenantContext as never);
    return { service, repo, manager };
  }

  const openInput: OpenGuardianLinkFollowupInput = {
    subjectPersonId: 'subject-1',
    reason: GuardianLinkFollowupReason.RETROACTIVE_MINORITY_LOCATION_CONSENT_SUSPENDED,
    relatedLocationConsentDecisionId: 'decision-1',
    triggeredByPersonId: 'staff-1',
  };

  describe('open', () => {
    test('test_open_freshInsert_returnsInsertedRow', async () => {
      const repo = createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue({ id: 'followup-1' }) });
      const { service } = buildService({ repo, insertedId: 'followup-1' });

      const result = await service.open(openInput);

      expect(repo.findOneByOrFail).toHaveBeenCalledWith({ id: 'followup-1' });
      expect(result).toEqual({ id: 'followup-1' });
    });

    test('test_open_alreadyOpenForSameSubjectAndReason_reselectsInsteadOfErroring', async () => {
      // Idempotency requirement: colliding with the DB's partial unique
      // index (tenant_id, subject_person_id, reason) WHERE status = 'open'
      // must behave as "already open", never as an error.
      const repo = createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue({ id: 'existing-open' }) });
      const { service } = buildService({ repo, insertedId: null });

      const result = await service.open(openInput);

      expect(repo.findOneByOrFail).toHaveBeenCalledWith({
        tenantId: 'tenant-a-id',
        subjectPersonId: 'subject-1',
        reason: GuardianLinkFollowupReason.RETROACTIVE_MINORITY_LOCATION_CONSENT_SUSPENDED,
        status: 'open',
      });
      expect(result).toEqual({ id: 'existing-open' });
    });
  });

  describe('findById', () => {
    test('test_findById_delegatesToRepositoryFindOneBy', async () => {
      const repo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'followup-1' }) });
      const { service } = buildService({ repo });

      const result = await service.findById('followup-1');

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'followup-1' });
      expect(result).toEqual({ id: 'followup-1' });
    });

    test('test_findById_notFound_returnsNull', async () => {
      const repo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ repo });

      await expect(service.findById('missing')).resolves.toBeNull();
    });
  });

  describe('listOpenBySubject', () => {
    test('test_listOpenBySubject_filtersBySubjectAndOpenStatus_orderedByOpenedAtAscending', async () => {
      const rows = [{ id: 'followup-1' }];
      const repo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const { service } = buildService({ repo });

      const result = await service.listOpenBySubject('subject-1');

      expect(repo.find).toHaveBeenCalledWith({
        where: { subjectPersonId: 'subject-1', status: 'open' },
        order: { openedAt: 'ASC' },
      });
      expect(result).toBe(rows);
    });
  });

  describe('listAllOpen', () => {
    test('test_listAllOpen_ordersByOpenedAtAscending', async () => {
      const rows = [{ id: 'followup-1' }];
      const repo = createMockRepository({ find: jest.fn().mockResolvedValue(rows) });
      const { service } = buildService({ repo });

      const result = await service.listAllOpen();

      expect(repo.find).toHaveBeenCalledWith({ where: { status: 'open' }, order: { openedAt: 'ASC' } });
      expect(result).toBe(rows);
    });
  });

  describe('resolve', () => {
    test('test_resolve_openItem_updatesTheFourResolutionColumnsAndReturnsIt', async () => {
      const repo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOneByOrFail: jest.fn().mockResolvedValue({ id: 'followup-1', status: 'resolved' }),
      });
      const { service } = buildService({ repo });

      const result = await service.resolve('followup-1', 'staff-1', 'Vínculo confirmado presencialmente');

      expect(repo.update).toHaveBeenCalledWith(
        { id: 'followup-1', status: 'open' },
        expect.objectContaining({
          status: 'resolved',
          resolvedByPersonId: 'staff-1',
          resolutionNote: 'Vínculo confirmado presencialmente',
        }),
      );
      expect(result).toEqual({ id: 'followup-1', status: 'resolved' });
    });

    test('test_resolve_doesNotExist_throwsNotFound', async () => {
      const repo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        findOneBy: jest.fn().mockResolvedValue(null),
      });
      const { service } = buildService({ repo });

      await expect(service.resolve('missing', 'staff-1', 'note')).rejects.toThrow(NotFoundException);
    });

    test('test_resolve_alreadyResolved_throwsConflictNotNotFound', async () => {
      const repo = createMockRepository({
        update: jest.fn().mockResolvedValue({ affected: 0 }),
        findOneBy: jest.fn().mockResolvedValue({ id: 'followup-1', status: 'resolved' }),
      });
      const { service } = buildService({ repo });

      await expect(service.resolve('followup-1', 'staff-1', 'note')).rejects.toThrow(ConflictException);
    });
  });
});
