import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'attendance_config' })
export class AttendanceConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // scopeType/scopeId let a tenant define config at institution, course, or
  // class_group level (RULE-ATT-04/05). Null scopeId = institution-wide default.
  @Column({ name: 'scope_type', type: 'varchar', length: 20 })
  scopeType: string;

  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId: string | null;

  // Controle A (RULE-ATT-04): percentage of ONE session the student must stay
  // in to be marked present in that session. Snapshotted onto class_session
  // at creation time, so config changes never recalculate past sessions.
  @Column({ name: 'min_attendance_percentage', type: 'numeric', precision: 5, scale: 2 })
  minAttendancePercentage: number;

  // Controle B (RULE-FREQ-01 addendum, 2026-09-03): percentage of the
  // reporting period's classes the student must ATTEND in order not to fail
  // by absence — a different question from the column above ("stayed 75% of
  // the class" vs "attended 75% of the classes"), and the same institution
  // may set different values for each. Neither derives a default from the
  // other. RULE-FREQ-03's +10 p.p. warning trigger and RULE-FREQ-07's "below
  // the minimum" comparison hang on THIS column. Never snapshotted: Controle
  // B always resolves it live (RULE-FREQ-02 addendum).
  @Column({ name: 'min_accumulated_frequency_percentage', type: 'numeric', precision: 5, scale: 2 })
  minAccumulatedFrequencyPercentage: number;

  // Controle B (RULE-FREQ-02): the reporting period the accumulated frequency
  // is measured over — bimester | trimester | semester, nothing else. Same
  // Controle B family as the column above (shared prefix on purpose), and
  // unrelated to any Controle A parameter. Feeds the pure slicing function of
  // the approved technology decision: 2, 3 or 6 calendar months from
  // class_group.term_start_date, last slice absorbing the remainder — the
  // period boundaries are computed, never stored (no academic-calendar
  // table). Never snapshotted: like the minimum above, Controle B resolves it
  // live (RULE-FREQ-02 addendum — a configuration change applies to the
  // period already in progress).
  @Column({ name: 'accumulated_frequency_period', type: 'varchar', length: 20 })
  accumulatedFrequencyPeriod: string;

  @Column({ name: 'tolerance_minutes', type: 'int' })
  toleranceMinutes: number;

  // One of exactly three values per RULE-ATT-14: block_checkin | deny_presence | register_only.
  @Column({ name: 'post_tolerance_behavior', type: 'varchar', length: 20 })
  postToleranceBehavior: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
