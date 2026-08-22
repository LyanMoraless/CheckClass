import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
