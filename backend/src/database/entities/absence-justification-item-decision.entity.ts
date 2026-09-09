import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Frente 07 — RULE-JUST-17's non-destructive decision trail: approving,
// rejecting or revoking an item INSERTs a new row here, never UPDATEs an
// existing one — that is what lets a revocation "não apague a aprovação
// original, apenas registre que foi revogada" (RULE-JUST-17.1) without any
// special-case column juggling on the item itself.
//
// Only human decisions get a row: cancelled_by_student and
// closed_subject_removed are NOT here — RULE-JUST-18.3 is explicit that
// those transitions have no professor motivo, so they are recorded purely as
// a status/terminal_at change on the item, with no decision act to log.
//
// Deliberately NOT append-only at the DB level (no REVOKE + trigger, unlike
// absence_justification_attachment_access_log). RULE-JUST-11.3's "convenção
// de código não é controle aceitável" is textually scoped to the attachment
// ACCESS trail, which the Security Agent named explicitly; nothing in
// RULE-JUST-17 asks for that mechanism here, and this codebase reserves it
// for where a rule names it (exam_session_event, this table's sibling
// absence_justification_attachment_access_log). The "never UPDATE" guarantee
// this table needs is met by the table's shape (every write is an INSERT)
// plus application discipline — flagged explicitly in the handoff for
// Security to revisit if a stronger DB-level guarantee is wanted here too.
//
// person_id/class_group_id/subject_id are denormalized from the item, frozen
// at write time and protected by a composite FK (see the migration) — they
// exist so this table's own RLS policies (student_ownership,
// teacher_subject_scope, mirroring the item's) are a plain column comparison
// instead of a join back to absence_justification_item on every row.
@Entity({ name: 'absence_justification_item_decision' })
export class AbsenceJustificationItemDecisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  // Denormalized from the item — see entity comment above and the composite
  // FK in the migration.
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  // approved | rejected | revoked
  @Column({ name: 'decision_type', type: 'varchar', length: 20 })
  decisionType: string;

  // Always the professor of the (turma, matéria) — RULE-JUST-08/17.2 — never
  // derived from leadership.
  @Column({ name: 'decided_by_person_id', type: 'uuid' })
  decidedByPersonId: string;

  // Required for rejected/revoked (RULE-JUST-03 addendum item 1,
  // RULE-JUST-17.1), optional for approved — enforced by a CHECK in the
  // migration, not here.
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'decided_at' })
  decidedAt: Date;
}
