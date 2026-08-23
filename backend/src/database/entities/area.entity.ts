import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Self-referencing hierarchy: a top-level row (parentAreaId null) models a
// "bloco"; a row with parentAreaId set models a nested "área"/andar/
// corredor inside it. See AddArea migration for the full reasoning.
@Entity({ name: 'area' })
export class AreaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'parent_area_id', type: 'uuid', nullable: true })
  parentAreaId: string | null;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
