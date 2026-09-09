// Frente 07 — closed vocabularies and numeric limits, mirrored 1:1 from the
// CHECK constraints already enforced by the AddAbsenceJustification
// migration (never a second source of truth — these arrays exist so the
// DTOs/services can validate BEFORE hitting the DB, with a clean 400/422
// instead of a raw constraint-violation error).

// RULE-JUST-12: the fixed, system-wide list of legal categories — same 9
// slugs as absence_justification_submission_legal_category_check.
export const ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES = [
  'illness_temporary_incapacity',
  'pregnancy_maternity_leave',
  'military_service',
  'judicial_electoral_summons',
  'official_sports_representation',
  'student_representation',
  'religious_conviction_exemption',
  'family_bereavement',
  'other_institutional_regulation',
] as const;

export type AbsenceJustificationLegalCategory = (typeof ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES)[number];

// RULE-JUST-11 (Security Agent, format/size decision — DECIDIDO 2026-09-08):
// PDF, JPEG, PNG, up to 10 MB, one file per pedido. SVG/HTML/compressed/
// executables are prohibited without negotiation — this allow-list, not a
// deny-list, is the enforcement of that.
export const ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;

export const ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

// RULE-JUST-15: 15 dias corridos from the falta becoming definitive.
export const ABSENCE_JUSTIFICATION_SUBMISSION_DEADLINE_DAYS = 15;

// RULE-JUST-09/19: 30 days after the submission's last item reaches a
// terminal state.
export const ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS = 30;
