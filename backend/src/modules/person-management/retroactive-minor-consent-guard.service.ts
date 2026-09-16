import { Injectable } from '@nestjs/common';
import { LocationConsentDecisionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { GuardianLinkFollowupReason, GuardianLinkFollowupService } from '../guardian-link-followup/guardian-link-followup.service';

// RULE-GRD-07 pendência 1 (business-rules/references/legal-guardian-consent-rules.md,
// approved 2026-09-15): triggered by PersonManagementService.confirmDateOfBirth
// whenever a presencial confirmation newly reveals minority for a person who
// already had a sensitive consent GRANTED *by themself* (decided_by_person_id
// set — as opposed to already granted by a legal_guardian, RULE-GRD-02/03,
// which is already the correct path for a minor and needs no suspension).
// Suspends that consent — a new 'revoked' row, never an UPDATE/DELETE
// (location_consent_decision is append-only, no UPDATE/DELETE DB grant, see
// AddLegalGuardianAndLocationConsentDecision migration) — and flags that the
// legal_guardian vínculo flow (RULE-GRD-02/05) must be (re-)completed before
// that consent can be granted again.
//
// Scope note: only location_consent_decision (RULE-PRES-14) exists in this
// backend today. RULE-FACE-09 (biometric consent) is not implemented yet —
// when it is, its own consent-decision table/service must get the exact same
// treatment via a new private method here, not a second divergent mechanism.
//
// Schema note: this suspension row is written with decided_by_type =
// 'system' (nobody decided — RULE-GRD-07's soft block fires automatically)
// and system_action_triggered_by_person_id = the Secretaria staff who
// performed the date-of-birth confirmation that triggered it — distinct from
// decided_by_person_id/decided_by_legal_guardian_id, which record WHO
// DECIDED and are both left unset here, as the DB CHECK on decided_by_type =
// 'system' requires. See AddLegalGuardianAndLocationConsentDecision
// migration.
@Injectable()
export class RetroactiveMinorConsentGuardService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly guardianLinkFollowup: GuardianLinkFollowupService,
  ) {}

  async suspendSensitiveConsentsIfGranted(subjectPersonId: string, suspendedByPersonId: string): Promise<void> {
    await this.suspendLocationConsentIfSelfGranted(subjectPersonId, suspendedByPersonId);
    // Plug-in point for RULE-FACE-09 once its consent-decision table/service
    // exists — see class header.
  }

  private async suspendLocationConsentIfSelfGranted(subjectPersonId: string, suspendedByPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(LocationConsentDecisionEntity);

    const latest = await repository.findOne({
      where: { subjectPersonId },
      order: { capturedAt: 'DESC' },
    });

    // Nothing to suspend if there is no consent, it isn't currently
    // 'granted', or it was already granted BY A GUARDIAN — that last case is
    // already the correct path for a minor, not the risk this guards
    // against.
    if (!latest || latest.decision !== 'granted' || !latest.decidedByPersonId) {
      return;
    }

    const saved = await repository.save(
      repository.create({
        tenantId,
        subjectPersonId,
        decidedByType: 'system',
        systemActionTriggeredByPersonId: suspendedByPersonId,
        decision: 'revoked',
        consentVersion: latest.consentVersion,
      }),
    );

    // RULE-GRD-07 pendência 1 production-readiness gap (Security,
    // 2026-09-15): a real, traceable trigger of the legal-guardian vínculo
    // flow, replacing the previous logger.warn-only signal. Opened in the
    // SAME transaction as the suspension row above — both go through this
    // request's this.tenantContext.getManager() (TenantContextService.
    // runWithTenant), one atomic event with two effects, not two separate
    // ones. See architecture-overview.md's "Proposta do Solution Architect
    // para o gatilho real do fluxo de responsável legal".
    await this.guardianLinkFollowup.open({
      subjectPersonId,
      reason: GuardianLinkFollowupReason.RETROACTIVE_MINORITY_LOCATION_CONSENT_SUSPENDED,
      relatedLocationConsentDecisionId: saved.id,
      triggeredByPersonId: suspendedByPersonId,
    });
  }
}
