import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Frente 07 — RULE-JUST-21/22: the justification notice, written from
// scratch, sharing nothing structurally with attendance_frequency_warning
// (RULE-JUST-22 is explicit: "nada herdado do aviso de frequência"). Read
// together in a single list by the same student-facing surface
// (RULE-JUST-22.6, extending frequency-warning-read.service.ts /
// GET /v1/me/warnings) — that is a read-side concern for the Backend Agent,
// not a reason to share a table.
//
// Never physically deleted (RULE-JUST-22.3, deliberate divergence from
// attendance_frequency_warning's physical DELETE on "frequency went back
// up") — it is proof the student was informed of an academic decision.
// Termination is one of two non-destructive events, both readable straight
// off this row: the student dismisses it (dismissed_at), or it stops being
// shown 30 days after issuance (created_at + 30 days, computed at read time,
// no separate expiry column — same "don't materialize what's cheap to
// compute" call already made for attendance_frequency_warning).
//
// notice_type has two values, not one, even though RULE-JUST-21.1 literally
// says "um aviso por (envio, matéria)" in the singular:
//   - decision_result — the (envio, matéria) reaching a terminal state
//     (RULE-JUST-21);
//   - approval_revoked — RULE-JUST-17.5's separate notice, which can arrive
//     well after decision_result was already issued, read, or expired.
// The UNIQUE constraint is (submission_id, subject_id, notice_type), not
// (submission_id, subject_id) alone, precisely so RULE-JUST-17.5 is not
// blocked by RULE-JUST-21.1's uniqueness. THIS SPLIT IS AN INFERENCE, not
// literal text of either rule — flagged explicitly to the Orchestrator/
// Business Analyst in the handoff. A third case is deliberately left OUT of
// the CHECK'd vocabulary: every item of an (envio, matéria) closing as
// closed_subject_removed with no item ever decided arguably also satisfies
// RULE-JUST-21.1's trigger condition ("todos os itens atingem estado
// terminal"), but no rule's content items (RULE-JUST-21.3/21.4) describe
// what such a notice would say. Left unmodeled on purpose; adding a third
// notice_type later is a purely additive migration.
//
// details is jsonb, not a wall of nullable columns, because what it needs to
// hold genuinely differs by notice_type (frequency before/after % on
// approval, professor's motivo + resend eligibility on rejection, motivo on
// revocation) — same precedent already used for exam_session_event.details
// and raw_identification_event.raw_payload. It MAY carry category,
// description and rejection motivo, unlike every other reader of this data:
// RULE-JUST-22.5 says explicitly the notice area is the titular's own, so
// the RULE-JUST-08/12/20/24 cut that hides this content from leadership and
// other-subject teachers does not apply to the person the data is about.
@Entity({ name: 'absence_justification_notice' })
export class AbsenceJustificationNoticeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // Exclusive recipient: the student titular (RULE-JUST-22.5). No professor,
  // coordinator or direção reads this table, ever.
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  // decision_result | approval_revoked — see entity comment above.
  @Column({ name: 'notice_type', type: 'varchar', length: 30 })
  noticeType: string;

  @Column({ type: 'jsonb' })
  details: Record<string, unknown>;

  // Mirrors attendance_frequency_warning.seenAt's name and semantics
  // (RULE-JUST-22.6's unified unread count reads both tables uniformly) —
  // unlike that column, being seen here never resets anything, it is purely
  // informational (RULE-JUST-22.2: "não some ao ser lido").
  @Column({ name: 'seen_at', type: 'timestamptz', nullable: true })
  seenAt: Date | null;

  @Column({ name: 'dismissed_at', type: 'timestamptz', nullable: true })
  dismissedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
