import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Mobile refresh-token persistence (Security Agent's "Decisão de segurança —
// Autenticação Mobile", approved 2026-08-22). Only the SHA-256 hash of the
// token is stored (device-auth.service.ts convention for high-entropy
// server-generated secrets) — never the raw token. `revokedAt` +
// `replacedByTokenId` support rotation-with-reuse-detection: rotating a
// token sets both on the old row and points it at the new one; presenting a
// token that already has `replacedByTokenId` set is the reuse signal that
// triggers revoking the whole family (every row for that `personId`).
@Entity({ name: 'refresh_token' })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 128 })
  tokenHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'replaced_by_token_id', type: 'uuid', nullable: true })
  replacedByTokenId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
