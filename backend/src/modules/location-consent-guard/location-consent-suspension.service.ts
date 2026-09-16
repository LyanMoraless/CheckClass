import { Injectable } from '@nestjs/common';
import { LocationConsentDecisionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { GuardianLinkFollowupReason, GuardianLinkFollowupService } from '../guardian-link-followup/guardian-link-followup.service';

export interface SuspendAndOpenFollowupInput {
  subjectPersonId: string;
  // The row read via getLatestDecision(subjectPersonId) — the guard
  // condition that decides WHETHER to call this method (self-granted?
  // decided by this specific guardian?) is caller-specific and stays in the
  // caller; this method is only the shared body that runs once that
  // decision has already been made. consentVersion is carried forward from
  // it into the new suspension row.
  latest: LocationConsentDecisionEntity;
  reason: GuardianLinkFollowupReason;
  triggeredByPersonId: string;
}

// Shared mechanic extracted from RetroactiveMinorConsentGuardService
// (behavior-preserving — see "Decisão de arquitetura — CRUD de
// legal_guardian", architecture-overview.md): "read the most recent
// location_consent_decision row for a subject" and "suspend it (insert a
// new decided_by_type = 'system', decision = 'revoked' row) + open a
// guardian_link_followup item" now have a single owner, reused by both
// RetroactiveMinorConsentGuardService's original trigger (retroactive
// minority discovery) and LegalGuardianService.revoke()'s new trigger
// (guardian revocation) — same mechanism, different callers, different
// `reason`.
//
// Deliberately named location-consent-guard, not location-consent: this
// module only ever suspends an existing decision, it never grants/refuses
// one (RULE-PRES-14's own grant/refuse endpoints, if built, belong in a
// different, not-yet-existing module) — consistent with the
// location_consent_decision_system_revoked_only_check DB constraint already
// in place.
@Injectable()
export class LocationConsentSuspensionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly guardianLinkFollowup: GuardianLinkFollowupService,
  ) {}

  // "Linha mais recente por capturedAt" read, shared by both callers so
  // there is exactly one definition of "the effective consent decision"
  // instead of two independently-maintained copies.
  async getLatestDecision(subjectPersonId: string): Promise<LocationConsentDecisionEntity | null> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(LocationConsentDecisionEntity);
    return repository.findOne({
      where: { subjectPersonId },
      order: { capturedAt: 'DESC' },
    });
  }

  // The body already existing after RetroactiveMinorConsentGuardService's
  // original guard condition (see that class's history) — inserts the
  // 'system'-revoked row and opens the matching guardian_link_followup item
  // in the same transaction (both go through this.tenantContext.getManager()
  // / TenantContextService.runWithTenant), now generalized to accept
  // `reason` and be caller-agnostic.
  async suspendAndOpenFollowup(input: SuspendAndOpenFollowupInput): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(LocationConsentDecisionEntity);

    const saved = await repository.save(
      repository.create({
        tenantId,
        subjectPersonId: input.subjectPersonId,
        decidedByType: 'system',
        systemActionTriggeredByPersonId: input.triggeredByPersonId,
        decision: 'revoked',
        consentVersion: input.latest.consentVersion,
      }),
    );

    await this.guardianLinkFollowup.open({
      subjectPersonId: input.subjectPersonId,
      reason: input.reason,
      relatedLocationConsentDecisionId: saved.id,
      triggeredByPersonId: input.triggeredByPersonId,
    });
  }
}
