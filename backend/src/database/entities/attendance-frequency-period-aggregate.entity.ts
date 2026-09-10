import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Frente 10 — Conformidade LGPD e retenção. Durable, incremental replacement
// for Controle B's full-rescan of `session_attendance_consolidation`
// (`AttendanceFrequencyEngineService.countInWindow()`), approved in the
// Frente 10 technology decision (architecture-overview.md, item 3) as the
// resolution to Open Question 1 of the Frente 10 architecture: RULE-RET-01
// purges `session_attendance_consolidation` after 60 days, which the old
// full-rescan silently depended on surviving for the whole reporting period
// (up to 6 months for a semester). This table is that dependency made
// explicit and durable — one row per (person, turma, matéria, period),
// numerator/denominator persisted and updated incrementally at each
// finalization event instead of re-derived from history that may no longer
// exist.
//
// Deliberately a NEW table, not an extension of `attendance_frequency_
// warning`: that table's grain has no period dimension (tenant, person,
// class_group, subject only) and its row is physically DELETED when the
// frequency recovers (RULE-FREQ-04 addendum a) — incompatible with an
// aggregate that must keep existing exactly when there is no active warning,
// and that needs one row per period, not one mutable "current" row.
//
// `period_start_date`/`period_end_date` are the same reporting-period
// boundaries already computed by the pure `currentPeriodWindow()` slicing
// function (`attendance-frequency/reporting-period.util.ts`) — `date`
// columns, UTC-midnight convention, matching that function's return type and
// mirroring `attendance_frequency_warning.period_start_date/period_end_date`
// exactly.
//
// No RLS ownership scoping beyond tenant_id: same posture as its sibling
// `attendance_frequency_warning` (tenant_isolation only) — this is a
// backend-computed aggregate read/written by application code during normal
// request-scoped session-finalization flows (`recalculate()` /
// `recalculateForSessionPerson()` / `reconcileForPerson()`), never by the
// unattended retention job, so it does not need the
// `app.attendance_retention_job` GUC door introduced for
// `attendance_closure_document` in this same migration.
//
// Updating the numerator/denominator incrementally at each finalization
// event (rather than re-deriving them from a full rescan) is the Backend
// Agent's logic to build on top of this table — out of scope here.
@Entity({ name: 'attendance_frequency_period_aggregate' })
export class AttendanceFrequencyPeriodAggregateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  // Boundaries of the reporting period this aggregate is a fact about — same
  // slicing convention as attendance_frequency_warning.period_start_date/
  // period_end_date (see file header).
  @Column({ name: 'period_start_date', type: 'date' })
  periodStartDate: Date;

  @Column({ name: 'period_end_date', type: 'date' })
  periodEndDate: Date;

  @Column({ name: 'present_count', type: 'int' })
  presentCount: number;

  @Column({ name: 'considered_count', type: 'int' })
  consideredCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
