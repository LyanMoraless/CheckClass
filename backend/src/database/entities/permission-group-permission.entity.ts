import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'permission_group_permission' })
export class PermissionGroupPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'permission_group_id', type: 'uuid' })
  permissionGroupId: string;

  @Column({ name: 'permission_code', type: 'varchar', length: 50 })
  permissionCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
