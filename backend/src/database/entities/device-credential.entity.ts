import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// WebAuthn credential (RULE-DEV-01), shared shape for institutional_machine
// and personal_device via device_identity_id (Tech Decision A:
// @simplewebauthn/server). public_key is stored raw (never hashed) because
// it must be read back to verify a signature, unlike a symmetric secret
// (refresh_token/device.api_key_secret_hash). At most one 'active' row per
// device_identity_id is enforced by a DB partial unique index — see the
// AddDeviceBinding migration for the reimage/re-matrícula reasoning
// (RULE-DEV-01 exception).
@Entity({ name: 'device_credential' })
export class DeviceCredentialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'device_identity_id', type: 'uuid' })
  deviceIdentityId: string;

  @Column({ name: 'credential_id', type: 'text' })
  credentialId: string;

  @Column({ name: 'public_key', type: 'bytea' })
  publicKey: Buffer;

  // Anti-replay signature counter (RULE-DEV-01) — must only ever increase;
  // enforced by application logic at verification time (@simplewebauthn's
  // own check), this column just persists it.
  @Column({ type: 'bigint' })
  counter: string;

  @Column({ type: 'text', array: true, nullable: true })
  transports: string[] | null;

  @Column({ name: 'backed_up', type: 'boolean', default: false })
  backedUp: boolean;

  @Column({ name: 'device_type', type: 'varchar', length: 20, nullable: true })
  deviceType: string | null;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;
}
