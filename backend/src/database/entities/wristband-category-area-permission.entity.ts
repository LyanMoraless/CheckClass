import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-ACC-02's concrete area-permission grant: a wristband category is
// authorized in an area, optionally bounded by an absolute validity window
// (the "período" part of "área, bloco, período"). See
// AddWristbandCategoryAreaPermission migration for the full reasoning.
@Entity({ name: 'wristband_category_area_permission' })
export class WristbandCategoryAreaPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'wristband_category_id', type: 'uuid' })
  wristbandCategoryId: string;

  @Column({ name: 'area_id', type: 'uuid' })
  areaId: string;

  @Column({ name: 'valid_from', type: 'timestamptz', nullable: true })
  validFrom: Date | null;

  @Column({ name: 'valid_until', type: 'timestamptz', nullable: true })
  validUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
