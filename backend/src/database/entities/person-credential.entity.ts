import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// One credential per person, login unified on CPF (confirmed 2026-08-22 —
// globally unique per real person, which is exactly what resolves "which
// tenant is this login for" from the credential alone, the same problem
// device auth already solved for API keys).
@Entity({ name: 'person_credential' })
export class PersonCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ type: 'varchar', length: 11 })
  cpf: string;

  // bcrypt, not the SHA-256 used for device API-key secrets — a password is
  // low-entropy and human-chosen, needing a deliberately slow/salted
  // algorithm to resist brute force; a device secret is a high-entropy
  // random value where a fast hash is the right tradeoff.
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
