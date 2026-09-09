import { ForbiddenException, Injectable } from '@nestjs/common';
import { TenantEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

// RULE-JUST-10: the Absence Justification area exists only for tenants
// whose institutionType is 'faculdade' — the attachment carries a minor's
// health data, under LGPD's regime reforçado, and the rule has no
// exceptions.
//
// Same mechanism as ExamAvailabilityService.assertExamAreaEnabled()
// (architecture-overview.md addendum, 2026-09-08): read tenant.institutionType
// straight from the tenant registry (not RLS-scoped — id IS the tenant, no
// tenant_id column of its own) and deny outside the allowed set. What is
// deliberately DIFFERENT here: this is the first Portal gate where
// faculdade and escola land on different sides of the check — every prior
// institutionType gate (Área de Provas included) grouped the two together
// against 'empresa'. So this compares against the literal 'faculdade'
// only; do NOT reuse tenant-bootstrap.service.ts's INSTITUTION_TYPES list
// here, it still includes 'escola'.
@Injectable()
export class AbsenceJustificationAreaGateService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async assertAreaEnabled(): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const tenant = await this.tenantContext.getManager().getRepository(TenantEntity).findOneBy({ id: tenantId });

    if (!tenant || tenant.institutionType !== 'faculdade') {
      throw new ForbiddenException(
        'The Absence Justification area is only available to faculdade institutions (RULE-JUST-10)',
      );
    }
  }
}
