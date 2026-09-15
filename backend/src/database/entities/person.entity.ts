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

  // RULE-GRD-01: source of truth for majority calculation (never a stored
  // "is minor" boolean — always derived at read time). RULE-GRD-05: only the
  // Secretaria's dedicated endpoint may read/write this raw value; every
  // other profile must go through the shared "é menor" helper — that
  // read-control allowlist lives in the controller/service layer, not here.
  // Nullable: pre-existing people have no birth date yet (RULE-GRD-07
  // backfill gap, resolved as a soft block at the consent gate, not here).
  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth: Date | null;

  // RULE-GRD-07 estado duplo (provisório vs. confirmado presencialmente),
  // derived from the combination of these two columns plus dateOfBirth
  // above — no separate status enum. See AddPersonDateOfBirth migration for
  // the exact 3-state semantics and the DB-level pairing/ordering checks.
  @Column({ name: 'date_of_birth_confirmed_at', type: 'timestamptz', nullable: true })
  dateOfBirthConfirmedAt: Date | null;

  @Column({ name: 'date_of_birth_confirmed_by_person_id', type: 'uuid', nullable: true })
  dateOfBirthConfirmedByPersonId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
