import { InstitutionalNetworkRangeEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { InstitutionalNetworkService } from './institutional-network.service';

// GAP-10 (RULE-DEV-14) — "Decisão de tecnologia — Detecção de rede
// institucional / GAP-10 (2026-09-11)". Covers the shared match primitive
// only (isWithinInstitutionalNetwork) — the admin CRUD of ranges has its own
// spec (institutional-network-range.service.spec.ts), and neither of
// GAP-10's two call sites (DeviceBindingService.createBinding, the future
// Frente 13 login-decision flow) is re-tested here.
describe('InstitutionalNetworkService', () => {
  function buildService(ranges: Array<Partial<InstitutionalNetworkRangeEntity>>) {
    const rangeRepo = createMockRepository({ findBy: jest.fn().mockResolvedValue(ranges) });
    const repositoriesByEntity = new Map<unknown, MockRepository>([[InstitutionalNetworkRangeEntity, rangeRepo]]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);

    const service = new InstitutionalNetworkService(tenantContext as never);
    return { service, rangeRepo };
  }

  test('test_isWithinInstitutionalNetwork_tenantHasNoRangesConfigured_returnsFalse', async () => {
    const { service, rangeRepo } = buildService([]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '203.0.113.5');

    expect(result).toBe(false);
    expect(rangeRepo.findBy).toHaveBeenCalledWith({ tenantId: 'tenant-a-id' });
  });

  test('test_isWithinInstitutionalNetwork_ipInsideSingleConfiguredRange_returnsTrue', async () => {
    const { service } = buildService([{ cidr: '203.0.113.0/24' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '203.0.113.5');

    expect(result).toBe(true);
  });

  test('test_isWithinInstitutionalNetwork_ipOutsideSingleConfiguredRange_returnsFalse', async () => {
    const { service } = buildService([{ cidr: '203.0.113.0/24' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '198.51.100.9');

    expect(result).toBe(false);
  });

  // Multiple ranges — main building vs. annex/guest Wi-Fi, per the schema's
  // own N-rows-per-tenant design (institutional-network-range.entity.ts).
  test('test_isWithinInstitutionalNetwork_matchesSecondOfSeveralConfiguredRanges_returnsTrue', async () => {
    const { service } = buildService([{ cidr: '10.0.0.0/24' }, { cidr: '203.0.113.0/24' }, { cidr: '198.51.100.0/24' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '203.0.113.5');

    expect(result).toBe(true);
  });

  test('test_isWithinInstitutionalNetwork_matchesNoneOfSeveralConfiguredRanges_returnsFalse', async () => {
    const { service } = buildService([{ cidr: '10.0.0.0/24' }, { cidr: '203.0.113.0/24' }, { cidr: '198.51.100.0/24' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '192.0.2.9');

    expect(result).toBe(false);
  });

  test('test_isWithinInstitutionalNetwork_malformedSourceIp_returnsFalseRatherThanThrowing', async () => {
    const { service } = buildService([{ cidr: '203.0.113.0/24' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', 'not-an-ip-address');

    expect(result).toBe(false);
  });

  // Defensive: institutional_network_range.cidr is Postgres' native `cidr`
  // type (rejects malformed notation at write time), so a corrupt row
  // should never actually reach here — but one bad row must never throw and
  // block every OTHER configured range from being checked.
  test('test_isWithinInstitutionalNetwork_oneStoredRangeIsMalformed_skipsItAndStillMatchesAnotherValidRange', async () => {
    const { service } = buildService([{ cidr: 'not-a-valid-cidr' }, { cidr: '203.0.113.0/24' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '203.0.113.5');

    expect(result).toBe(true);
  });

  test('test_isWithinInstitutionalNetwork_onlyMalformedRangesConfigured_returnsFalseRatherThanThrowing', async () => {
    const { service } = buildService([{ cidr: 'garbage/64' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '203.0.113.5');

    expect(result).toBe(false);
  });

  // ipaddr.js's match() throws (not returns false) across address families —
  // an IPv4 source against an IPv6-only configured range must be a clean
  // skip, not a thrown/unhandled error propagating out of the method.
  test('test_isWithinInstitutionalNetwork_ipv4SourceAgainstIpv6ConfiguredRange_returnsFalseWithoutThrowing', async () => {
    const { service } = buildService([{ cidr: '2001:db8::/32' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '203.0.113.5');

    expect(result).toBe(false);
  });

  test('test_isWithinInstitutionalNetwork_ipv6SourceInsideConfiguredIpv6Range_returnsTrue', async () => {
    const { service } = buildService([{ cidr: '2001:db8::/32' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '2001:db8::1');

    expect(result).toBe(true);
  });

  // ipaddr.js's process() folds an IPv4-mapped IPv6 address (what a
  // dual-stack socket can hand back as req.ip) down to plain IPv4 before
  // matching — otherwise this would incorrectly fail the kind() check
  // against an IPv4-only configured range.
  test('test_isWithinInstitutionalNetwork_ipv4MappedIpv6SourceAgainstIpv4Range_normalizesAndReturnsTrue', async () => {
    const { service } = buildService([{ cidr: '203.0.113.0/24' }]);

    const result = await service.isWithinInstitutionalNetwork('tenant-a-id', '::ffff:203.0.113.5');

    expect(result).toBe(true);
  });
});
