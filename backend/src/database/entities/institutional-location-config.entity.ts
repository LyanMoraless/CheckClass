import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Institutional reference point + radius (RULE-PRES-01/09) — singleton per
// tenant. See AddInstitutionalLocationConfig migration for the full
// reasoning (why singleton, why not merged into device_binding_config/
// attendance_config, why no PostGIS).
@Entity({ name: 'institutional_location_config' })
export class InstitutionalLocationConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', unique: true })
  tenantId: string;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  latitude: number;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  longitude: number;

  @Column({ name: 'radius_meters', type: 'int' })
  radiusMeters: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
