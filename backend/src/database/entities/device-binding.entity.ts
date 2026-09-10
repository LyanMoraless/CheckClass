import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Pessoa<->máquina ciclo de vida (RULE-DEV-06/07/08). RULE-DEV-07 (one
// active binding per person) is enforced by a DB partial unique index, not
// just application logic — see the AddDeviceBinding migration. The
// idempotent checkout operation the Solution Architect specified
// (`UPDATE device_binding SET status='checked_out', checked_out_at=...,
// checkout_reason=... WHERE id=... AND status='active'`) is the only
// legal way to transition status — whichever of the four RULE-DEV-06
// triggers reaches the database first wins; the rest find the row already
// checked_out and no-op.
@Entity({ name: 'device_binding' })
export class DeviceBindingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'device_identity_id', type: 'uuid' })
  deviceIdentityId: string;

  // active | checked_out.
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'checked_out_at', type: 'timestamptz', nullable: true })
  checkedOutAt: Date | null;

  // logout | session_end | inactivity_timeout | token_expired (RULE-DEV-06,
  // emended — the four checkout triggers).
  @Column({ name: 'checkout_reason', type: 'varchar', length: 30, nullable: true })
  checkoutReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
