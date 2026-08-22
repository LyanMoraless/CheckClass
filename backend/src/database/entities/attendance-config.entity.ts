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

  @Column({ name: 'min_attendance_percentage', type: 'numeric', precision: 5, scale: 2 })
  minAttendancePercentage: number;

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
