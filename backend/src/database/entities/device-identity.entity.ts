import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Supertype anchor for institutional_machine/personal_device
// (class-table-inheritance — see AddDeviceBinding migration for why this
// isn't one wide table with a discriminator). device_credential and
// device_binding reference this id, never the subtype tables directly.
// Nothing at the DB level enforces that exactly one subtype row exists per
// id — the application must create this row and its one subtype row inside
// a single transaction (same precedent as class_group.entity.ts's
// course_id comment).
@Entity({ name: 'device_identity' })
export class DeviceIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
