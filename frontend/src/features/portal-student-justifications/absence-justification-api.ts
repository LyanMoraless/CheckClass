import type { BadgeTone } from '../../components/badge';
import { api, type DownloadedFile } from '../../lib/api-client';

// Frente 07 — RULE-JUST-01 addendum/06/12: the 9 fixed legal-category slugs,
// mirrored 1:1 from
// backend/src/modules/absence-justification/absence-justification.constants.ts
// (ABSENCE_JUSTIFICATION_LEGAL_CATEGORIES). Kept in sync manually, same
// posture as types/permission.ts's own header comment — frontend/backend are
// separate deployable units with no shared package.
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

// Portuguese labels — a Frontend Agent UX decision (RULE-JUST-12 defines the
// slugs and the legal-amparo table, never a screen label). Composition
// follows the left column of RULE-JUST-12's own table, which that rule
// itself flags as "proposta pendente de validação jurídica" — not restated
// as settled fact here, just rendered faithfully.
export const LEGAL_CATEGORY_LABELS: Record<AbsenceJustificationLegalCategory, string> = {
  illness_temporary_incapacity: 'Doença ou incapacidade física temporária',
  pregnancy_maternity_leave: 'Gestação / licença-maternidade estudantil',
  military_service: 'Convocação militar',
  judicial_electoral_summons: 'Convocação judicial ou eleitoral',
  official_sports_representation: 'Representação desportiva oficial',
  student_representation: 'Representação estudantil em órgão colegiado',
  religious_conviction_exemption: 'Escusa de consciência por convicção religiosa',
  family_bereavement: 'Falecimento de familiar',
  other_institutional_regulation: 'Outro previsto no regimento da instituição',
};

// RULE-JUST-11 (Security Agent, DECIDIDO 2026-09-08): PDF/JPEG/PNG, up to
// 10 MB, one file per pedido — mirrored 1:1 from
// ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES/_MAX_SIZE_BYTES.
// Enforced here ONLY as UX (fail fast, no wasted upload attempt) — the
// backend re-validates by magic-bytes regardless, so this is never the last
// line of defense.
export const ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;
export const ABSENCE_JUSTIFICATION_ATTACHMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png';

// under_review -> {approved, rejected, cancelled_by_student,
// closed_subject_removed}; approved -> approval_revoked (RULE-JUST-06/17/18)
// — mirrored from AbsenceJustificationItemEntity.status. closed_subject_removed
// has no call site yet on the backend (no "remover matéria da turma" admin
// flow exists), but is kept here so the status switch stays exhaustive
// instead of silently falling through if it ever appears.
export type AbsenceJustificationItemStatus =
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled_by_student'
  | 'closed_subject_removed'
  | 'approval_revoked';

export const ITEM_STATUS_BADGE: Record<AbsenceJustificationItemStatus, { label: string; tone: BadgeTone }> = {
  under_review: { label: 'Em análise', tone: 'warning' },
  approved: { label: 'Aprovada', tone: 'success' },
  rejected: { label: 'Rejeitada', tone: 'danger' },
  cancelled_by_student: { label: 'Cancelada por você', tone: 'neutral' },
  closed_subject_removed: { label: 'Encerrada — matéria removida da turma', tone: 'neutral' },
  approval_revoked: { label: 'Aprovação revogada', tone: 'danger' },
};

// Mirrors AbsenceJustificationSubmissionEntity. legalCategory/description are
// sensitive-by-content (RULE-JUST-12/04) — this shape is only ever returned
// by the student's own /mine and /:submissionId/items routes (self-scoped),
// never by any teacher/leadership-facing endpoint.
export interface AbsenceJustificationSubmission {
  id: string;
  personId: string;
  startDate: string;
  endDate: string;
  legalCategory: AbsenceJustificationLegalCategory;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Mirrors AbsenceJustificationItemEntity exactly — the SAME shape is
// returned both by the student's own GET .../items and by the teacher's
// GET /v1/absence-justification-items/queue (see
// portal-teacher-justifications/absence-justification-decision-api.ts),
// which is why this type lives here and is imported from there rather than
// duplicated, same cross-feature-import precedent already used by
// portal-exams importing from features/exams.
export interface AbsenceJustificationItem {
  id: string;
  submissionId: string;
  personId: string;
  classSessionId: string;
  classGroupId: string;
  subjectId: string;
  status: AbsenceJustificationItemStatus;
  decidedByPersonId: string | null;
  decidedAt: string | null;
  terminalAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// RULE-JUST-14's six exclusion reasons — mirrored from
// AbsenceJustificationExclusionReason (absence-justification-eligibility.service.ts).
export type AbsenceJustificationExclusionReason =
  | 'session_cancelled'
  | 'not_evaluated_yet'
  | 'already_present'
  | 'pending_review'
  | 'already_justified'
  | 'already_under_review'
  | 'before_enrollment'
  | 'deadline_expired';

export interface AbsenceJustificationExcludedSession {
  classSessionId: string;
  scheduledStart: string;
  reason: AbsenceJustificationExclusionReason;
}

// Portuguese labels for the exclusion reasons above (RULE-JUST-14's "o
// sistema mostra ao aluno... o motivo de exclusão de cada sessão descartada").
export const EXCLUSION_REASON_LABELS: Record<AbsenceJustificationExclusionReason, string> = {
  session_cancelled: 'Aula cancelada — não gera pendência de falta',
  not_evaluated_yet: 'A chamada desta aula ainda não foi lançada',
  already_present: 'Você já constava como presente nesta aula — para contestar, use a revisão de chamada, não este pedido',
  pending_review: 'Esta aula está aguardando resolução de revisão de chamada — resolva a pendência antes de justificar',
  already_justified: 'Esta aula já tem uma justificativa aprovada',
  already_under_review: 'Já existe um pedido em análise para esta aula',
  before_enrollment: 'Esta aula é anterior ao início da sua matrícula nesta turma',
  deadline_expired: 'O prazo para justificar esta aula (15 dias corridos, ou o fechamento do período de apuração) já encerrou',
};

export interface CreateAbsenceJustificationInput {
  startDate: string;
  endDate: string;
  legalCategory: AbsenceJustificationLegalCategory;
  description: string;
  file: File;
}

export interface CreateAbsenceJustificationResult {
  submission: AbsenceJustificationSubmission;
  items: AbsenceJustificationItem[];
  excluded: AbsenceJustificationExcludedSession[];
}

// POST /v1/absence-justifications — multipart/form-data (RULE-JUST-01
// addendum: the attachment always travels alongside the other fields, never
// as a separate upload step). personId always comes from the JWT on the
// backend (AbsenceJustificationSubmissionController), never sent from here.
export async function createAbsenceJustification(
  input: CreateAbsenceJustificationInput,
): Promise<CreateAbsenceJustificationResult> {
  const formData = new FormData();
  formData.append('startDate', input.startDate);
  formData.append('endDate', input.endDate);
  formData.append('legalCategory', input.legalCategory);
  formData.append('description', input.description);
  formData.append('file', input.file, input.file.name);
  return api.postMultipart('/v1/absence-justifications', formData);
}

export async function listMyAbsenceJustifications(): Promise<AbsenceJustificationSubmission[]> {
  return api.get('/v1/absence-justifications/mine');
}

export async function listAbsenceJustificationItems(submissionId: string): Promise<AbsenceJustificationItem[]> {
  return api.get(`/v1/absence-justifications/${submissionId}/items`);
}

// RULE-JUST-05.4: only possible while no item of the submission has been
// decided yet — the backend is the actual enforcer (400 otherwise); the
// screen only uses item status to decide whether to SHOW the button.
export async function cancelAbsenceJustification(submissionId: string): Promise<{ submissionId: string; status: string }> {
  return api.post(`/v1/absence-justifications/${submissionId}/cancel`);
}

// RULE-JUST-11.5/11.8: streamed through the backend with reauthorization on
// every open — never a cached/public/signed URL. Reachable by both the
// titular (student) and the item's subject-teacher — see
// portal-teacher-justifications for the professor-side call site of this
// same function.
export async function downloadAbsenceJustificationAttachment(submissionId: string): Promise<DownloadedFile> {
  return api.getBlob(`/v1/absence-justifications/${submissionId}/attachment`);
}

export type AbsenceJustificationAttachmentAccessResult = 'granted' | 'denied' | 'deleted_unavailable';

// RULE-JUST-11.4: "o aluno titular sempre pode ver o próprio anexo e saber
// quem o abriu" — titular-only on the backend (403 for anyone else,
// including the subject-teacher).
export interface AbsenceJustificationAttachmentAccessLogEntry {
  id: string;
  attachmentId: string;
  attachmentOwnerPersonId: string;
  accessedByPersonId: string;
  accessResult: AbsenceJustificationAttachmentAccessResult;
  denialReason: string | null;
  ipAddress: string;
  userAgent: string | null;
  occurredAt: string;
}

export async function listAbsenceJustificationAttachmentAccessLog(
  submissionId: string,
): Promise<AbsenceJustificationAttachmentAccessLogEntry[]> {
  return api.get(`/v1/absence-justifications/${submissionId}/attachment/access-log`);
}
