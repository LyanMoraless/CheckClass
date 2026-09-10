import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-DEV-06 gatilho 3's configurable inactivity threshold. Tenant-scoped,
// deliberately its own table rather than a column on attendance_config
// (Solution Architect: "domínios diferentes: higiene de sessão vs. política
// de apuração"). One row per tenant — unlike attendance_config there is no
// evidence of a need for course/turma-level scoping here.
@Entity({ name: 'device_binding_config' })
export class DeviceBindingConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'inactivity_timeout_minutes', type: 'int' })
  inactivityTimeoutMinutes: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
