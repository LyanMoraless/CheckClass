import * as FileSystem from 'expo-file-system/legacy';
import { apiClient, type DownloadedFile } from '../../lib/api-client';
import type { AttachmentAsset } from './attachment-picker';
import type { BadgeTone } from './status-badge';

// Frente 07 — RULE-JUST-01 addendum/06/12: the 9 fixed legal-category slugs, mirrored 1:1 from
// the web dashboard's absence-justification-api.ts (itself mirrored from
// backend/src/modules/absence-justification/absence-justification.constants.ts). Kept in sync
// manually — every deployable unit of this project (backend, web, mobile) is separate, no shared
// package.
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

// English labels — every other mobile screen already ships English-only UI text regardless of
// the web dashboard's Portuguese (see WarningsScreen/CheckInScreen/LoginScreen), an established
// mobile-specific convention this feature follows rather than reintroducing Portuguese here.
export const LEGAL_CATEGORY_LABELS: Record<AbsenceJustificationLegalCategory, string> = {
  illness_temporary_incapacity: 'Illness or temporary incapacity',
  pregnancy_maternity_leave: 'Pregnancy / student maternity leave',
  military_service: 'Military service summons',
  judicial_electoral_summons: 'Judicial or electoral summons',
  official_sports_representation: 'Official sports representation',
  student_representation: 'Student representation on a collegiate body',
  religious_conviction_exemption: 'Religious conviction exemption',
  family_bereavement: 'Family bereavement',
  other_institutional_regulation: 'Other, per institutional regulation',
};

// RULE-JUST-11 (Security Agent, DECIDED 2026-09-08): PDF/JPEG/PNG, up to 10 MB, one file per
// request — mirrored 1:1 from the web dashboard's own constants.
export const ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export const ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

// under_review -> {approved, rejected, cancelled_by_student, closed_subject_removed};
// approved -> approval_revoked (RULE-JUST-06/17/18) — mirrored from the web dashboard's
// AbsenceJustificationItemStatus.
export type AbsenceJustificationItemStatus =
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'cancelled_by_student'
  | 'closed_subject_removed'
  | 'approval_revoked';

export const ITEM_STATUS_BADGE: Record<AbsenceJustificationItemStatus, { label: string; tone: BadgeTone }> = {
  under_review: { label: 'Under review', tone: 'warning' },
  approved: { label: 'Approved', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  cancelled_by_student: { label: 'Cancelled by you', tone: 'neutral' },
  closed_subject_removed: { label: 'Closed — subject removed from class group', tone: 'neutral' },
  approval_revoked: { label: 'Approval revoked', tone: 'danger' },
};

// Mirrors AbsenceJustificationSubmissionEntity — this shape (the full submission row: period,
// legalCategory, description at the submission level) is only ever returned by the student's own
// /mine and /:submissionId/items routes (self-scoped), never by any teacher/leadership-facing
// endpoint. The teacher-facing queue/decided endpoints below return item-level rows
// (AbsenceJustificationQueueItem) that join in just legalCategory/description, never this shape.
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

// RULE-JUST-14's exclusion reasons — mirrored from the web dashboard's
// AbsenceJustificationExclusionReason.
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

export const EXCLUSION_REASON_LABELS: Record<AbsenceJustificationExclusionReason, string> = {
  session_cancelled: 'Class was cancelled — nothing to justify',
  not_evaluated_yet: 'Attendance for this class has not been recorded yet',
  already_present: 'You were marked present for this class — to contest that, use attendance review, not this request',
  pending_review: 'This class is awaiting attendance review — that must be resolved before it can be justified',
  already_justified: 'This class already has an approved justification',
  already_under_review: 'A request for this class is already under review',
  before_enrollment: 'This class is before your enrollment start date in this class group',
  deadline_expired: 'The deadline to justify this class (15 calendar days, or the assessment period closing) has passed',
};

export interface CreateAbsenceJustificationInput {
  startDate: string;
  endDate: string;
  legalCategory: AbsenceJustificationLegalCategory;
  description: string;
  file: AttachmentAsset;
}

export interface CreateAbsenceJustificationResult {
  submission: AbsenceJustificationSubmission;
  items: AbsenceJustificationItem[];
  excluded: AbsenceJustificationExcludedSession[];
}

// POST /v1/absence-justifications — multipart/form-data (RULE-JUST-01 addendum: the attachment
// always travels alongside the other fields, never as a separate upload step). personId always
// comes from the JWT on the backend, never sent from here.
//
// React Native's FormData accepts a `{ uri, name, type }` object for a file part instead of a
// browser File/Blob — TypeScript resolves FormData.append's signature against the DOM lib's
// `Blob`-only overload, which has no way to express that RN shape, hence the cast.
export async function createAbsenceJustification(input: CreateAbsenceJustificationInput): Promise<CreateAbsenceJustificationResult> {
  const formData = new FormData();
  formData.append('startDate', input.startDate);
  formData.append('endDate', input.endDate);
  formData.append('legalCategory', input.legalCategory);
  formData.append('description', input.description);
  formData.append('file', { uri: input.file.uri, name: input.file.name, type: input.file.mimeType } as unknown as Blob);
  return apiClient.postMultipart<CreateAbsenceJustificationResult>('/v1/absence-justifications', formData);
}

export async function listMyAbsenceJustifications(): Promise<AbsenceJustificationSubmission[]> {
  return apiClient.get<AbsenceJustificationSubmission[]>('/v1/absence-justifications/mine');
}

export async function listAbsenceJustificationItems(submissionId: string): Promise<AbsenceJustificationItem[]> {
  return apiClient.get<AbsenceJustificationItem[]>(`/v1/absence-justifications/${submissionId}/items`);
}

// RULE-JUST-05.4: only possible while no item of the submission has been decided yet — the
// backend is the actual enforcer (400 otherwise); the screen only uses item status to decide
// whether to SHOW the button.
export async function cancelAbsenceJustification(submissionId: string): Promise<{ submissionId: string; status: string }> {
  return apiClient.post(`/v1/absence-justifications/${submissionId}/cancel`);
}

export type AbsenceJustificationAttachmentAccessResult = 'granted' | 'denied' | 'deleted_unavailable';

// RULE-JUST-11.4: "o aluno titular sempre pode ver o próprio anexo e saber quem o abriu" —
// titular-only on the backend (403 for anyone else, including the subject-teacher — out of
// scope here, this task is student-side only).
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

export async function listAbsenceJustificationAttachmentAccessLog(submissionId: string): Promise<AbsenceJustificationAttachmentAccessLogEntry[]> {
  return apiClient.get<AbsenceJustificationAttachmentAccessLogEntry[]>(`/v1/absence-justifications/${submissionId}/attachment/access-log`);
}

export type DownloadedAttachment = DownloadedFile;

// RULE-JUST-11.5/11.8: streamed through the backend with reauthorization on every open — never a
// cached/public/signed URL. Written ONLY under FileSystem.cacheDirectory, never
// documentDirectory (which is eligible for OS backup/sync) — this is health data
// (RULE-JUST-04/11), and there is no permanent copy of it on the backend either
// (RULE-JUST-11.5), so the app must not create one on the device on its own. The caller (the
// detail screen) owns deleting this file once it's done sharing/viewing it — see
// justification-detail-screen.tsx for that lifecycle.
export async function downloadAbsenceJustificationAttachment(submissionId: string): Promise<DownloadedAttachment> {
  if (!FileSystem.cacheDirectory) {
    // Only null on web, where this whole download/preview flow (built around
    // FileSystem/DocumentPicker/Sharing's native behavior) is out of scope for this task —
    // flagged in the Mobile Implementation Summary rather than silently degraded.
    throw new Error('Local cache storage is not available on this platform.');
  }
  const destinationUri = `${FileSystem.cacheDirectory}absence-justification-${submissionId}-${Date.now()}`;
  return apiClient.downloadToFile(`/v1/absence-justifications/${submissionId}/attachment`, destinationUri);
}

// Best-effort cleanup of a downloaded attachment's temporary local copy — see
// justification-detail-screen.tsx for every call site (after sharing/viewing finishes, and as a
// safety net on unmount). idempotent: true means calling this twice, or on a URI that was never
// written, is never an error.
export async function deleteDownloadedAttachment(localUri: string): Promise<void> {
  await FileSystem.deleteAsync(localUri, { idempotent: true });
}

// ---- Professor decision queue (RULE-JUST-03/06/08/17/24) ----
//
// The web dashboard splits student-facing and teacher-facing calls into two files
// (portal-student-justifications/absence-justification-api.ts and
// portal-teacher-justifications/absence-justification-decision-api.ts) because it already has a
// role-based feature split to hang that on. Mobile doesn't (see (app)/_layout.tsx's comment: the
// JWT only carries { personId, tenantId }, no role/actorType, so every screen is shown to every
// authenticated person and the backend is the sole authorization source) — so both roles' calls
// live together in this one file, same underlying backend contract as the web dashboard's.

// The queue/decided endpoints below join in the submission's legalCategory/description alongside
// the item's own columns — a shape the plain student-facing AbsenceJustificationItem doesn't have
// (that one is item-only; legalCategory/description live on the submission there). Kept as its
// own type rather than widening AbsenceJustificationItem itself, since the student-facing
// endpoints above still return the narrower shape.
export interface AbsenceJustificationQueueItem extends AbsenceJustificationItem {
  legalCategory: AbsenceJustificationLegalCategory;
  description: string;
}

// RULE-JUST-06/08/24: only items of a (turma, matéria) this professor actually teaches, and only
// 'under_review' ones — server-side filtered, nothing to narrow further here.
export async function listAbsenceJustificationQueue(): Promise<AbsenceJustificationQueueItem[]> {
  return apiClient.get<AbsenceJustificationQueueItem[]>('/v1/absence-justification-items/queue');
}

// Items THIS professor has already decided (any status by default, or narrowed to a single
// status — the queue screen uses status=approved so RULE-JUST-17 revocations aren't limited to
// items decided earlier in the same session/device). Ordered by decidedAt desc server-side. Note:
// this listing does NOT re-validate RULE-JUST-17.3's período de apuração window — that only
// happens for real on POST .../revoke, so an item can appear here and still 400 when a revoke is
// actually attempted (handled as a normal ErrorBanner at the call site, not replicated here).
export async function listMyDecidedAbsenceJustificationItems(
  status?: AbsenceJustificationItemStatus,
): Promise<AbsenceJustificationQueueItem[]> {
  const query = status ? `?status=${status}` : '';
  return apiClient.get<AbsenceJustificationQueueItem[]>(`/v1/absence-justification-items/decided${query}`);
}

export interface DecideAbsenceJustificationItemInput {
  decision: 'approved' | 'rejected';
  // RULE-JUST-03 addendum item 1: required when rejecting, optional when approving — enforced
  // server-side; the UI only mirrors it to fail fast.
  note?: string;
}

export async function decideAbsenceJustificationItem(
  itemId: string,
  input: DecideAbsenceJustificationItemInput,
): Promise<AbsenceJustificationItem> {
  return apiClient.post<AbsenceJustificationItem>(`/v1/absence-justification-items/${itemId}/decide`, input);
}

// RULE-JUST-17: always requires a written note, only works on an item that is still 'approved'
// AND whose session's período de apuração is still the current one (backend 400s with a specific
// message otherwise — propagated as-is via errorMessage()).
export async function revokeAbsenceJustificationApproval(itemId: string, note: string): Promise<AbsenceJustificationItem> {
  return apiClient.post<AbsenceJustificationItem>(`/v1/absence-justification-items/${itemId}/revoke`, { note });
}
