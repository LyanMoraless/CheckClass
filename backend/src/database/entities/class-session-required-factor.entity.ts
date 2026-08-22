import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'class_session_required_factor' })
export class ClassSessionRequiredFactorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_session_id', type: 'uuid' })
  classSessionId: string;

  @Column({ name: 'attendance_factor_type_id', type: 'uuid' })
  attendanceFactorTypeId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
