import { WristbandEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { WristbandIdentityService } from './wristband-identity.service';

// Covers the extraction from IdentificationService.resolvePerson() — the
// primitive must stay status-sensitive (RULE-ACC-01: a deactivated/revoked
// wristband must not resolve) exactly as it behaved before the extraction.
describe('WristbandIdentityService', () => {
  function buildService(findOneByResult: WristbandEntity | null) {
    const wristbandRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(findOneByResult) });
    const manager = createMockEntityManager(new Map([[WristbandEntity, wristbandRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const service = new WristbandIdentityService(tenantContext as never);
    return { service, wristbandRepo };
  }

  test('test_resolveByTagCode_activeWristbandFound_returnsPersonAndCategory', async () => {
    const { service, wristbandRepo } = buildService({
      id: 'wristband-1',
      tenantId: 'tenant-a-id',
      personId: 'person-1',
      wristbandCategoryId: 'category-1',
      tagCode: 'TAG-1',
      status: 'active',
    } as WristbandEntity);

    const result = await service.resolveByTagCode('TAG-1');

    expect(result).toEqual({ personId: 'person-1', wristbandCategoryId: 'category-1' });
    expect(wristbandRepo.findOneBy).toHaveBeenCalledWith({ tagCode: 'TAG-1', status: 'active' });
  });

  test('test_resolveByTagCode_noActiveWristbandForTag_returnsNull', async () => {
    // Simulates both "unknown tag" and "deactivated/revoked wristband" — in
    // both cases findOneBy's status:'active' filter finds nothing.
    const { service } = buildService(null);

    const result = await service.resolveByTagCode('TAG-UNKNOWN-OR-REVOKED');

    expect(result).toBeNull();
  });
});
