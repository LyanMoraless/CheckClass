import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'attendance_config_required_factor' })
export class AttendanceConfigRequiredFactorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'attendance_config_id', type: 'uuid' })
  attendanceConfigId: string;

  @Column({ name: 'attendance_factor_type_id', type: 'uuid' })
  attendanceFactorTypeId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
