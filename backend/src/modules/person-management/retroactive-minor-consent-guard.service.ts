import { Injectable } from '@nestjs/common';
import { GuardianLinkFollowupReason } from '../guardian-link-followup/guardian-link-followup.service';
import { LocationConsentSuspensionService } from '../location-consent-guard/location-consent-suspension.service';

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
// Extraction note ("Decisão de arquitetura — CRUD de legal_guardian",
// architecture-overview.md): the actual "read latest decision" / "insert the
// 'system'-revoked row + open a guardian_link_followup item" mechanics now
// live in the shared LocationConsentSuspensionService (legal_guardian
// revocation is a second, unrelated trigger of that same mechanic) — this
// class keeps only the guard condition specific to retroactive-minority
// discovery ("was the latest decision granted by the subject THEMSELF"),
// preserving its original behavior exactly.
@Injectable()
export class RetroactiveMinorConsentGuardService {
  constructor(private readonly locationConsentSuspension: LocationConsentSuspensionService) {}

  async suspendSensitiveConsentsIfGranted(subjectPersonId: string, suspendedByPersonId: string): Promise<void> {
    await this.suspendLocationConsentIfSelfGranted(subjectPersonId, suspendedByPersonId);
    // Plug-in point for RULE-FACE-09 once its consent-decision table/service
    // exists — see class header.
  }

  private async suspendLocationConsentIfSelfGranted(subjectPersonId: string, suspendedByPersonId: string): Promise<void> {
    const latest = await this.locationConsentSuspension.getLatestDecision(subjectPersonId);

    // Nothing to suspend if there is no consent, it isn't currently
    // 'granted', or it was already granted BY A GUARDIAN — that last case is
    // already the correct path for a minor, not the risk this guards
    // against.
    if (!latest || latest.decision !== 'granted' || !latest.decidedByPersonId) {
      return;
    }

    await this.locationConsentSuspension.suspendAndOpenFollowup({
      subjectPersonId,
      latest,
      reason: GuardianLinkFollowupReason.RETROACTIVE_MINORITY_LOCATION_CONSENT_SUSPENDED,
      triggeredByPersonId: suspendedByPersonId,
    });
  }
}
