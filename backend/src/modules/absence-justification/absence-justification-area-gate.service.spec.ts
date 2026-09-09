import { TenantEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { AbsenceJustificationAreaGateService } from './absence-justification-area-gate.service';

// RULE-JUST-10: the Absence Justification area is faculdade-only, no
// exceptions — deliberately the FIRST institutionType gate in the Portal
// where 'escola' lands on the denied side (contrast with
// ExamAvailabilityService.assertExamAreaEnabled(), which allows both
// faculdade and escola against empresa).
describe('AbsenceJustificationAreaGateService', () => {
  function buildService(institutionType: string | undefined) {
    const tenantRepo: MockRepository = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(institutionType === undefined ? null : { id: 'tenant-a-id', institutionType }),
    });
    const manager = createMockEntityManager(new Map([[TenantEntity, tenantRepo]]));
    const tenantContext = createMockTenantContext(manager);
    const service = new AbsenceJustificationAreaGateService(tenantContext as never);
    return { service, tenantRepo, tenantContext };
  }

  test('test_assertAreaEnabled_faculdade_resolves', async () => {
    const { service } = buildService('faculdade');
    await expect(service.assertAreaEnabled()).resolves.toBeUndefined();
  });

  // The crux of RULE-JUST-10: unlike RULE-EXAM-02, escola is NOT let
  // through here.
  test('test_assertAreaEnabled_escola_forbidden', async () => {
    const { service } = buildService('escola');
    await expect(service.assertAreaEnabled()).rejects.toThrow(/RULE-JUST-10/);
  });

  test('test_assertAreaEnabled_empresa_forbidden', async () => {
    const { service } = buildService('empresa');
    await expect(service.assertAreaEnabled()).rejects.toThrow(/RULE-JUST-10/);
  });

  test('test_assertAreaEnabled_unknownInstitutionType_forbidden', async () => {
    const { service } = buildService('SCHOOL');
    await expect(service.assertAreaEnabled()).rejects.toThrow(/RULE-JUST-10/);
  });

  test('test_assertAreaEnabled_tenantNotFound_forbidden', async () => {
    const { service } = buildService(undefined);
    await expect(service.assertAreaEnabled()).rejects.toThrow(/RULE-JUST-10/);
  });

  test('test_assertAreaEnabled_readsTenantByCurrentTenantId', async () => {
    const { service, tenantRepo, tenantContext } = buildService('faculdade');
    await service.assertAreaEnabled();
    expect(tenantContext.getTenantId).toHaveBeenCalled();
    expect(tenantRepo.findOneBy).toHaveBeenCalledWith({ id: 'tenant-a-id' });
  });
});
