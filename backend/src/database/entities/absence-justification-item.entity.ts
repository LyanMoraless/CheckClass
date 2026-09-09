import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Frente 07 — RULE-JUST-06/13/14/16/18: one row per faltada class_session
// inside a submission's date range. This is the unit of decision (RULE-
// JUST-13: a concrete class_session, never a (day, matéria) pair) — "aprovado"
// and "rejeitado" are states of THIS row, never of the submission as a whole.
//
// class_group_id/subject_id are denormalized copies of class_session's own
// columns, frozen at item creation — same reasoning already used for
// attendance_frequency_warning: the professor's decision queue filters by
// (class_group_id, subject_id, status) without joining up to class_session
// on every list read, and RULE-JUST-24's teacher_subject_scope RLS policy
// (see the migration) reads these two columns directly for the same reason
// exam_answer denormalizes person_id — a plain column comparison instead of
// a correlated subquery through class_session on every row.
//
// status is NOT a state machine enforced by the DB (same posture as
// class_group_enrollment.enrollmentStatus — free transitions, validated by
// the application): under_review -> {approved, rejected, cancelled_by_student,
// closed_subject_removed}; approved -> approval_revoked (RULE-JUST-17.6,
// never back to rejected). The two structural invariants that ARE enforced
// at the DB (RULE-JUST-16 items 1-2 as partial UNIQUE indexes, see the
// migration) are: at most one under_review item per (class_session, person),
// and at most one approved item per (class_session, person) — revoking an
// approval frees the second index, allowing a fresh approval later
// (RULE-JUST-17.6).
//
// decided_by_person_id/decided_at/terminal_at are a snapshot of the LATEST
// decision only (fast read for queues/lists) — the full, never-overwritten
// history (including the original approval a later revocation must not
// erase, RULE-JUST-17.1) lives in absence_justification_item_decision.
// terminal_at is deliberately its own column, not read off updated_at: it is
// the exact input RULE-JUST-19.1 needs (the submission's attachment deletion
// clock starts when its LAST item's terminal_at is set), and updated_at is
// too generic a column to trust for something with a 30-day legal
// consequence attached to it. A revocation (approved -> approval_revoked)
// rewrites terminal_at, because RULE-JUST-19.1 counts revocation itself as a
// fresh terminal-reaching event for the item.
@Entity({ name: 'absence_justification_item' })
export class AbsenceJustificationItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'submission_id', type: 'uuid' })
  submissionId: string;

  // Denormalized from the submission — see the entity comment there and the
  // composite FK to (submission.id, submission.person_id) in the migration,
  // same "impossible to falsify" pattern already used by exam_answer against
  // exam_session.
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'class_session_id', type: 'uuid' })
  classSessionId: string;

  // Denormalized from class_session, frozen at creation — see entity
  // comment above.
  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  // under_review | approved | rejected | cancelled_by_student |
  // closed_subject_removed | approval_revoked
  @Column({ type: 'varchar', length: 30, default: 'under_review' })
  status: string;

  // Latest decision snapshot only — see entity comment above.
  @Column({ name: 'decided_by_person_id', type: 'uuid', nullable: true })
  decidedByPersonId: string | null;

  @Column({ name: 'decided_at', type: 'timestamptz', nullable: true })
  decidedAt: Date | null;

  // When THIS item last became terminal — see entity comment above
  // (RULE-JUST-19.1's input, rewritten on revocation).
  @Column({ name: 'terminal_at', type: 'timestamptz', nullable: true })
  terminalAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
