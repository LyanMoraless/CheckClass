import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'class_session' })
export class ClassSessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  @Column({ name: 'scheduled_start', type: 'timestamptz' })
  scheduledStart: Date;

  @Column({ name: 'scheduled_end', type: 'timestamptz' })
  scheduledEnd: Date;

  // Snapshot of attendance_config at the time of the session (RULE-ATT-04/05/14) —
  // later config changes must not retroactively recalculate past sessions.
  @Column({ name: 'min_attendance_percentage_snapshot', type: 'numeric', precision: 5, scale: 2 })
  minAttendancePercentageSnapshot: number;

  @Column({ name: 'tolerance_minutes_snapshot', type: 'int' })
  toleranceMinutesSnapshot: number;

  @Column({ name: 'post_tolerance_behavior_snapshot', type: 'varchar', length: 20 })
  postToleranceBehaviorSnapshot: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
