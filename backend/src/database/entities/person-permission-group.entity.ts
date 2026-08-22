import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'person_permission_group' })
export class PersonPermissionGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'permission_group_id', type: 'uuid' })
  permissionGroupId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
