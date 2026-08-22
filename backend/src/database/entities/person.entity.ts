import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'person' })
export class PersonEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'actor_type_id', type: 'uuid' })
  actorTypeId: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
