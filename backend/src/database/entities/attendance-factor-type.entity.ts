import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'attendance_factor_type' })
export class AttendanceFactorTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Null tenant_id = standard platform factor, shared across tenants.
  // Non-null = custom factor registered by that institution (RULE-ATT-13).
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'is_custom', type: 'boolean', default: false })
  isCustom: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
