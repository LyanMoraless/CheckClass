import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Frente 06 — Controle B's warning row (RULE-FREQ-03/04/07/08). See the
// AddAttendanceFrequencyWarning migration for the full reasoning; the three
// points below are repeated here because they are the ones most likely to be
// "corrected" by someone reading only this file:
//
// 1. `frequencyPercentage` is a smallint holding the ROUNDED value, on
//    purpose — not numeric(5,2) like Controle A's
//    `session_attendance_consolidation.attendance_percentage`. That column
//    stores a MEASUREMENT; this one stores an ALREADY-NORMALIZED DECISION
//    INPUT: RULE-FREQ-05.3 makes both comparisons (minimum, minimum + 10
//    p.p.) run on the rounded integer, so the rounded integer is the value
//    the system acted on. Persisting the raw percentage too would create two
//    truths (UI showing 69,6% while the system treats the student as 70%).
//    `presentCount`/`consideredCount` keep the raw ratio rederivable.
// 2. `warningType` is NOT part of the uniqueness key. The partial unique
//    index (tenant_id, person_id, class_group_id, subject_id) WHERE
//    status = 'active' is what enforces RULE-FREQ-07's "one warning at a
//    time per matéria": the two types are disjoint by construction, and a
//    transition between them is an UPDATE of this same row (resetting
//    `seenAt`), never a second row.
// 3. Controle B NEVER snapshots configuration — it always resolves the
//    effective config live at calculation time. This diverges deliberately
//    from the Controle A precedent (`class_session
//    .min_attendance_percentage_snapshot` and the comment in
//    tenant-config.service.ts, which says config changes must not
//    recalculate past sessions), because RULE-FREQ-02's addendum requires
//    the opposite for Controle B: changing the configuration mid-period
//    applies immediately to the current period. `minPercentageApplied` below
//    is a record of what was applied when the row was last written — for
//    explainability only — and must never be read as a configuration source.
@Entity({ name: 'attendance_frequency_warning' })
export class AttendanceFrequencyWarningEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  // The turma is part of the identity of a warning, not decoration: the
  // period window and the effective minimum both derive from it.
  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  // approaching_minimum | below_minimum (see note 2 above).
  @Column({ name: 'warning_type', type: 'varchar', length: 30 })
  warningType: string;

  // When the CURRENT type started applying — rewritten on every type
  // transition, untouched by a percentage update that keeps the same type.
  @Column({ name: 'warning_type_since', type: 'timestamptz' })
  warningTypeSince: Date;

  // Rounded integer percentage (see note 1 above).
  @Column({ name: 'frequency_percentage', type: 'smallint' })
  frequencyPercentage: number;

  @Column({ name: 'present_count', type: 'int' })
  presentCount: number;

  @Column({ name: 'considered_count', type: 'int' })
  consideredCount: number;

  // The min_accumulated_frequency_percentage in force when this row was last
  // written — explainability only, never a config source (see note 3 above).
  @Column({ name: 'min_percentage_applied', type: 'numeric', precision: 5, scale: 2 })
  minPercentageApplied: number;

  // Boundaries of the reporting period this warning is a fact about — the
  // slice of class_group.term_start_date/term_end_date computed by the pure
  // slicing function, not rows of any calendar table (none exists).
  @Column({ name: 'period_start_date', type: 'date' })
  periodStartDate: Date;

  @Column({ name: 'period_end_date', type: 'date' })
  periodEndDate: Date;

  // active | resolved. There is no 'dismissed': no rule lets the student
  // dismiss a warning.
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  // subject_removed_from_class_group | period_closed | enrollment_inactive —
  // set together with resolvedAt/status='resolved', enforced by a DB CHECK.
  // The fourth outcome, "the frequency went back up", is a physical DELETE
  // (RULE-FREQ-04 addendum a) and never lands here.
  @Column({ name: 'resolution_reason', type: 'varchar', length: 40, nullable: true })
  resolutionReason: string | null;

  // RULE-FREQ-04 item 1 ("first access after being generated"): set on the
  // first read of GET /v1/me/warnings, and reset to NULL whenever the
  // warningType changes, so a student crossing below the minimum is always
  // notified again.
  @Column({ name: 'seen_at', type: 'timestamptz', nullable: true })
  seenAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
