import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Frente 07 addendum (RULE-JUST-07/17.4) — status gained a 4th value,
// 'absent_justified', alongside present/absent/pending (CHECK'd for the
// first time by AddAbsenceJustificationToAttendanceConsolidation; previously
// unconstrained free text). It is NOT the same thing as 'present':
// RULE-JUST-07 requires an approved justified absence to count as presença
// in Controle B's numerator while remaining visibly distinct from a real
// presença — 'absent_justified' is that distinct value. Revoking the
// approval (RULE-JUST-17.4, "devolve o registro de presença ao estado
// absent") flips status back to 'absent', but justified_by_item_id is left
// SET, not nulled — that is what preserves "a marcação histórica de que
// houve uma justificativa aprovada e revogada" without a second column.
// resolved_by_person_id/resolved_at (Controle A's pending-review resolution
// author) are never touched by any of this — RULE-JUST-07's whole point is
// that approving a justification must not overwrite who resolved the
// original chamada pendency.
@Entity({ name: 'session_attendance_consolidation' })
export class SessionAttendanceConsolidationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_session_id', type: 'uuid' })
  classSessionId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'total_presence_minutes', type: 'int' })
  totalPresenceMinutes: number;

  @Column({ name: 'attendance_percentage', type: 'numeric', precision: 5, scale: 2 })
  attendancePercentage: number;

  // present | absent | pending
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ name: 'resolved_by_person_id', type: 'uuid', nullable: true })
  resolvedByPersonId: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  // Set when an absence_justification_item is approved for this
  // (class_session, person); left SET (not nulled) if that approval is later
  // revoked — see the entity-level comment above.
  @Column({ name: 'justified_by_item_id', type: 'uuid', nullable: true })
  justifiedByItemId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
