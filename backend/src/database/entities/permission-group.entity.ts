import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Institution-defined, not a fixed set of roles (confirmed 2026-08-22): each
// tenant starts with one root/admin group (created at bootstrap, holding
// every permission) and can create further groups of its own — e.g.
// "Secretaria", "RH" — with whatever permission subset it chooses.
@Entity({ name: 'permission_group' })
export class PermissionGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
