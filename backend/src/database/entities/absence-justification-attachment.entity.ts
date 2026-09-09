import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Frente 07 — RULE-JUST-09/11/19: METADATA ONLY. The binary never touches
// Postgres — storage_key is a reference into the object storage category
// already approved (S3-compatible, private bucket, SSE with a KMS-managed
// key outside the app process; concrete provider still open, see
// pending-decisions.md). This entity, and the client that talks to the
// bucket, are the Backend Agent's to build — nothing here chooses or
// implements that client.
//
// One row per submission (UNIQUE, "um arquivo por pedido" — RULE-JUST-16.4),
// 1:1, never the other way around: submission has no attachment_id column,
// so a submission can always be inserted before its attachment exists, no
// deferred-FK trick needed.
//
// Deletion (RULE-JUST-19) is a MUTATION of this one row — storage_key set to
// NULL, deleted_at stamped — never a DELETE of the row, and nothing else
// points AT this table (no FK from item/item_decision/submission/notice
// requires it to exist). That is what makes RULE-JUST-11.9/19.4's
// decoupling requirement structural rather than a discipline: eliminating
// the file cannot cascade into the decision, because nothing is wired to
// cascade. original_filename/mime_type are kept even after deletion so the
// system can answer "this attachment existed and was eliminated" instead of
// a bare 404 — RULE-JUST-19.5 explicitly forbids a generic error here.
@Entity({ name: 'absence_justification_attachment' })
export class AbsenceJustificationAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  // Denormalized owner (the student) — powers this table's own
  // student_ownership RLS policy as a plain column comparison, same pattern
  // as exam_answer.person_id; protected by the composite FK in the
  // migration.
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  // The object storage key. NULL after elimination (RULE-JUST-19) — the row
  // survives, the pointer to a now-nonexistent object does not.
  @Column({ name: 'storage_key', type: 'varchar', length: 500, nullable: true })
  storageKey: string | null;

  @Column({ name: 'original_filename', type: 'varchar', length: 255 })
  originalFilename: string;

  // One of PDF/JPEG/PNG (RULE-JUST-11, format decision) — CHECK'd in the
  // migration by MIME type.
  @Column({ name: 'mime_type', type: 'varchar', length: 100 })
  mimeType: string;

  // <= 10 MB (RULE-JUST-11, size decision) — CHECK'd in the migration.
  @Column({ name: 'size_bytes', type: 'int' })
  sizeBytes: number;

  @CreateDateColumn({ name: 'uploaded_at' })
  uploadedAt: Date;

  // Set once every item of the submission reaches a terminal state
  // (RULE-JUST-19.1/19.2), or immediately if every item is
  // cancelled_by_student before any decision (RULE-JUST-19.3). NULL while
  // the submission still has a non-terminal item. Computing this is the
  // caller's job (whoever transitions the last item), not a DB trigger —
  // no rule mandates DB-level enforcement of this specific clock, unlike the
  // access log's append-only requirement.
  @Column({ name: 'scheduled_deletion_at', type: 'timestamptz', nullable: true })
  scheduledDeletionAt: Date | null;

  // Set when the object is actually removed from storage. The presence of
  // this column (independent of storage_key) is what lets an "already
  // eliminated" response (RULE-JUST-19.5) be told apart from "never had an
  // attachment to begin with", which cannot happen here (every submission
  // has exactly one attachment row, so absence of the row itself is never a
  // valid state to explain to a caller).
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
