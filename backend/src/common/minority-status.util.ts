import { hydrateNullableDate } from './utc-date.util';

// RULE-GRD-01 (business-rules/references/legal-guardian-consent-rules.md):
// legal majority is 18 years — the only number this codebase treats as
// "adult", always recalculated at read time, never re-derived per
// tenant/state and never stored as a redundant flag.
const LEGAL_MAJORITY_AGE_YEARS = 18;

export type BirthDateConfirmationState = 'absent' | 'provisional' | 'confirmed';

export interface PersonBirthDateFields {
  // `date`-typed column: comes back as a real `Date` from a raw
  // manager.query() but as a plain "YYYY-MM-DD" string from
  // repository.findOneBy/findOne (same driver inconsistency utc-date.util.ts
  // documents for class_group.term_start_date/term_end_date) — accepting
  // both here means every caller can pass whichever shape their read path
  // happens to produce, instead of normalizing twice.
  dateOfBirth: Date | string | null;
  dateOfBirthConfirmedAt: Date | string | null;
}

export interface MinorityStatus {
  // null only when dateOfBirth itself is unset (RULE-GRD-07 "ausente") —
  // majority is genuinely unknown, never defaulted to either true or false.
  isMinor: boolean | null;
  // RULE-GRD-07's estado duplo, purely derived from the combination of the
  // two columns below — no separate status enum stored anywhere (same
  // fonte-única principle RULE-GRD-01 already applies to "é menor" itself).
  confirmationState: BirthDateConfirmationState;
}

// Single reusable source of "é menor" (RULE-GRD-01) plus the RULE-GRD-07
// estado duplo (ausente/provisório/confirmado), derived at read time from
// person.date_of_birth / person.date_of_birth_confirmed_at — never a stored
// boolean flag. Every consumer other than the Secretaria's restricted
// person-management endpoints (RULE-GRD-05, read-control allowlist enforced
// in PersonManagementController/Service) MUST go through this helper (or
// PersonMinorityStatusService, which wraps it for DB access) instead of ever
// reading person.date_of_birth directly.
export function deriveMinorityStatus(person: PersonBirthDateFields, asOf: Date = new Date()): MinorityStatus {
  const dateOfBirth = hydrateNullableDate(person.dateOfBirth);
  const confirmedAt = hydrateNullableDate(person.dateOfBirthConfirmedAt);

  if (!dateOfBirth) {
    return { isMinor: null, confirmationState: 'absent' };
  }

  return {
    isMinor: calculateAgeYears(dateOfBirth, asOf) < LEGAL_MAJORITY_AGE_YEARS,
    confirmationState: confirmedAt ? 'confirmed' : 'provisional',
  };
}

// RULE-GRD-07 pendência 3 (approved 2026-09-15): while the confirmation
// state is anything other than "confirmado presencialmente", sensitive
// consent flows (RULE-FACE-09 biometria; RULE-PRES-14 localização) stay
// soft-blocked — "ausente" and "provisório" both block, regardless of what a
// provisional/self-declared value itself says about majority. This is the
// single gate both rules must call before granting or renewing sensitive
// consent for a person deciding for THEMSELF; neither rule is implemented in
// this backend yet — see PersonMinorityStatusService.
// assertSensitiveConsentGateOpen for the pluggable call site.
export function isSensitiveConsentGateBlocked(status: MinorityStatus): boolean {
  return status.confirmationState !== 'confirmed';
}

function calculateAgeYears(dateOfBirth: Date, asOf: Date): number {
  // UTC convention (see utc-date.util.ts's top-of-file rationale) — same
  // "treat date-only fields as UTC calendar dates" principle already applied
  // codebase-wide, so this stays consistent regardless of the Node process's
  // local TZ.
  let age = asOf.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const birthdayAlreadyHappenedThisYear =
    asOf.getUTCMonth() > dateOfBirth.getUTCMonth() ||
    (asOf.getUTCMonth() === dateOfBirth.getUTCMonth() && asOf.getUTCDate() >= dateOfBirth.getUTCDate());
  if (!birthdayAlreadyHappenedThisYear) {
    age -= 1;
  }
  return age;
}
