import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// A session row exists only from the moment the student actually starts the
// exam — RULE-EXAM-12's NOT_STARTED and AVAILABLE are computed from the
// availability window (RULE-EXAM-06) and never persisted.
//
// One single attempt per student per exam (confirmed 2026-09-03), enforced
// by UNIQUE (tenant_id, exam_id, person_id) — there is no attempt number
// and no attempt allowance to configure.
@Entity({ name: 'exam_session' })
export class ExamSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  // Also the RLS ownership key: no student may read another student's
  // session (see AddExamArea migration).
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  // IN_PROGRESS | COMPLETED | TERMINATED | EXPIRED | ABANDONED.
  // ABANDONED = started, never finished, and the availability window closed
  // with the session still IN_PROGRESS (confirmed 2026-09-03) — the
  // complement of EXPIRED, which is the end of the individual duration.
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  // Absolute deadline served to the frontend once and re-served as-is on
  // reload (RULE-EXAM-07/11). NULL exactly when the session has no duration
  // limit.
  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt: Date | null;

  // Snapshot of the configuration in force when the session was created,
  // same precedent as class_session's *_snapshot columns: a teacher editing
  // the exam mid-flight must not change the rules of a session already
  // running.
  @Column({ name: 'duration_minutes_snapshot', type: 'int', nullable: true })
  durationMinutesSnapshot: number | null;

  @Column({ name: 'monitoring_mode_snapshot', type: 'varchar', length: 20 })
  monitoringModeSnapshot: string;

  @Column({ name: 'monitored_event_types_snapshot', type: 'text', array: true })
  monitoredEventTypesSnapshot: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
