import { ForbiddenException, Injectable } from '@nestjs/common';
import { PersonEntity } from '../../database/entities';
import { deriveMinorityStatus, isSensitiveConsentGateBlocked, MinorityStatus } from '../../common/minority-status.util';
import { TenantContextService } from '../../database/tenant-context.service';

// Reusable "é menor" + RULE-GRD-07 estado duplo lookup, backed by
// person.date_of_birth/date_of_birth_confirmed_at (RULE-GRD-01/05/07,
// business-rules/references/legal-guardian-consent-rules.md). This is the
// single call site RULE-FACE-09 (facial-verification-rules.md) and
// RULE-PRES-14 (attendance-presence-flow-rules.md) must reuse once those
// flows are implemented — neither exists in this backend yet, so
// assertSensitiveConsentGateOpen below has no real caller today; it is built
// now so the gate is one place instead of two divergent copies later.
@Injectable()
export class PersonMinorityStatusService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async getStatus(personId: string): Promise<MinorityStatus> {
    const manager = this.tenantContext.getManager();
    const person = await manager.getRepository(PersonEntity).findOneByOrFail({ id: personId });
    return deriveMinorityStatus(person);
  }

  // PLUG-IN POINT for RULE-FACE-09 (grant/renew biometric consent) and
  // RULE-PRES-14 (grant/renew location consent) — call this before recording
  // a 'granted' decision for `personId` deciding for THEMSELF (a guardian
  // consenting on behalf of a minor, RULE-GRD-02/03, is exactly the case
  // this gate must NOT block — do not call this for that path). Throws while
  // the state is "ausente" or "provisório"; only "confirmado
  // presencialmente" passes (RULE-GRD-07 pendência 3, approved 2026-09-15).
  async assertSensitiveConsentGateOpen(personId: string): Promise<void> {
    const status = await this.getStatus(personId);
    if (isSensitiveConsentGateBlocked(status)) {
      throw new ForbiddenException(
        `Person ${personId} has no presencially confirmed date of birth yet (RULE-GRD-07) — ` +
          'sensitive consent flows stay soft-blocked until the Secretaria confirms it in person.',
      );
    }
  }
}
