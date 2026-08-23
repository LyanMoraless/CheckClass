import { Injectable } from '@nestjs/common';
import { WristbandEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface ResolvedWristbandIdentity {
  personId: string;
  wristbandCategoryId: string;
}

// "Serviço de Identidade por Pulseira" (architecture-overview.md — Segurança
// de Intrusão, primeira rodada): the one small, shared, stable primitive both
// the attendance pipeline (IdentificationService) and the Segurança de
// Intrusão pipeline (Motor de Detecção de Intrusão) use to translate a
// physical tagCode into an identity. Extracted from
// IdentificationService.resolvePerson()'s tagCode branch — status-sensitive
// by design (a deactivated/revoked wristband must never resolve, RULE-ACC-01's
// "identidade do usuário" is meant to be the CURRENT holder, not whoever last
// held that physical tag), exactly the invariant IdentificationService
// enforced privately before this extraction. Behavior is unchanged, only the
// ownership moved.
@Injectable()
export class WristbandIdentityService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async resolveByTagCode(tagCode: string): Promise<ResolvedWristbandIdentity | null> {
    const manager = this.tenantContext.getManager();
    const wristband = await manager.getRepository(WristbandEntity).findOneBy({ tagCode, status: 'active' });
    if (!wristband) {
      return null;
    }
    return { personId: wristband.personId, wristbandCategoryId: wristband.wristbandCategoryId };
  }
}
