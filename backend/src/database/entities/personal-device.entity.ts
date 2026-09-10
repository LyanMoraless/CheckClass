import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// BYOD (RULE-DEV-02) — deliberately enxuto, none of RULE-DEV-04's inventory
// fields apply here. RULE-DEV-17 (one active BYOD per person) is enforced
// by a DB partial unique index, not just this entity's shape — see the
// AddDeviceBinding migration.
@Entity({ name: 'personal_device' })
export class PersonalDeviceEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  label: string | null;

  // RULE-DEV-18: revoked by the owner themself or by the inventory
  // administrator (Direção/Reitoria, RULE-DEV-15) — resolved by application
  // code from the caller's JWT; these two columns just record the outcome.
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'revoked_by_person_id', type: 'uuid', nullable: true })
  revokedByPersonId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
