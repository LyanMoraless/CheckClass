import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Frente 10 — Conformidade LGPD e retenção (RULE-RET-01/02). METADATA ONLY,
// same posture as absence_justification_attachment: the closure artifact
// itself lives in the approved S3-compatible object storage, in a bucket new
// and separate from the Frente 07 attachment bucket
// (`checkclass-attendance-retention-documents`, technology decision item 1)
// — different lifecycle (this row survives past annual consolidation with
// its content erased; the Frente 07 attachment row is erased 30 days after
// its decision), so a dedicated bucket keeps lifecycle/IAM policy simple
// instead of mixed rules inside one shared bucket/prefix.
//
// One row per (tenant, closure period): a monthly closure (RULE-RET-01,
// `period_type = 'monthly'`) or an annual consolidation (RULE-RET-02,
// `period_type = 'annual'`). `period_month` is only meaningful for monthly
// rows — enforced by the CHECK below — so a single nullable column covers
// both period shapes instead of two mutually-exclusive columns.
//
// `summary` is a size-limited jsonb of counts/aggregates (RULE-RET-01: "o
// sistema gera um documento de fechamento... consolidando os dados") — never
// the raw detailed content, which is what makes the CHECK below viable and
// avoids the anti-pattern the Frente 10 technology decision explicitly
// rejected (a year of consolidated data inline in jsonb: TOAST/backup
// weight). The bound is generous on purpose (this is a summary, not the
// dataset) but still a real ceiling, not an unenforced convention.
//
// storage_key/mime_type/size_bytes/checksum_sha256 mirror the reference
// fields already used by absence_justification_attachment for its S3 object,
// plus checksum_sha256 (SHA-256, same algorithm already used elsewhere in
// this codebase for device API keys/refresh tokens — technology decision
// item 1) because RULE-RET-01 explicitly expects the institution to copy
// this artifact to its own physical media, so its integrity must be
// verifiable after that copy, not just while it sits in this bucket.
//
// content_deleted_at is this table's equivalent of
// absence_justification_attachment.deletedAt: RULE-RET-02 has the annual
// consolidation ERASE the CONTENT of the 12 monthly artifacts it
// consolidates, but the metadata row survives (mime_type/size_bytes/
// checksum_sha256 are kept even after elimination, same reason
// original_filename/mime_type survive on the attachment table — so the
// system can answer "this closure document existed, here is its checksum"
// instead of a bare 404/no-row). storage_key is the one field actually
// nulled, exactly like the attachment table's storage_key.
//
// consolidated_into_document_id is a Database Agent structural addition, not
// a business rule: RULE-RET-02 says the annual consolidation eliminates the
// content "dos 12 documentos mensais associados" but never says how
// "associated" is identified. Filtering monthly rows by period_year against
// the annual row's period_year only works if the 12-month batch happens to
// align to a calendar year — the Frente 10 architecture explicitly leaves
// open (Open Question 6) whether "12 fechamentos" is a calendar year or a
// rolling window per tenant. A plain nullable self-FK, set by the
// consolidation job on each of the 12 monthly rows it just consolidated,
// removes that ambiguity regardless of how Open Question 6 is eventually
// resolved — Backend's consolidation service is the one writer of this
// column; nothing else depends on it existing.
@Entity({ name: 'attendance_closure_document' })
export class AttendanceClosureDocumentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // monthly | annual — see file header.
  @Column({ name: 'period_type', type: 'varchar', length: 10 })
  periodType: string;

  @Column({ name: 'period_year', type: 'smallint' })
  periodYear: number;

  // NULL for period_type = 'annual'. 1-12 for period_type = 'monthly'.
  @Column({ name: 'period_month', type: 'smallint', nullable: true })
  periodMonth: number | null;

  @CreateDateColumn({ name: 'generated_at' })
  generatedAt: Date;

  // Size-limited summary/counts only — never the raw detailed content (see
  // file header). CHECK'd in the migration.
  @Column({ name: 'summary', type: 'jsonb' })
  summary: Record<string, unknown>;

  // The object storage key, in the bucket dedicated to this table
  // (checkclass-attendance-retention-documents). NULL after the annual
  // consolidation erases this row's content (content_deleted_at set) — the
  // row survives, the pointer to a now-nonexistent object does not.
  @Column({ name: 'storage_key', type: 'varchar', length: 500, nullable: true })
  storageKey: string | null;

  // Kept even after content elimination — see file header.
  @Column({ name: 'mime_type', type: 'varchar', length: 100, nullable: true })
  mimeType: string | null;

  @Column({ name: 'size_bytes', type: 'int', nullable: true })
  sizeBytes: number | null;

  // SHA-256 of the artifact's content, hex-encoded (64 chars). Kept even
  // after content elimination, same reasoning as mime_type/size_bytes: it is
  // what lets the institution verify the copy it made to its own physical
  // media against what this row recorded, and it is the last evidence this
  // system holds once the content itself is gone.
  @Column({ name: 'checksum_sha256', type: 'char', length: 64 })
  checksumSha256: string;

  // Set when the annual consolidation actually erases this document's
  // content from object storage (RULE-RET-02). NULL for a monthly document
  // not yet consolidated, and always NULL for an annual document (nothing
  // ever eliminates an annual document's own content).
  @Column({ name: 'content_deleted_at', type: 'timestamptz', nullable: true })
  contentDeletedAt: Date | null;

  // Set on a monthly row by the annual consolidation job, pointing at the
  // annual row it was folded into — see file header.
  @Column({ name: 'consolidated_into_document_id', type: 'uuid', nullable: true })
  consolidatedIntoDocumentId: string | null;
}
