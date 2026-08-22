import { MigrationInterface, QueryRunner } from 'typeorm';

// Mobile refresh-token persistence (Security Agent's "Decisão de segurança —
// Autenticação Mobile", approved 2026-08-22). One row per issued refresh
// token, hashed the same way as the device API-key secret
// (device-auth.service.ts: SHA-256, not bcrypt — this is a high-entropy
// server-generated value, not a low-entropy human password like
// person_credential.password_hash).
//
// Rotation-with-reuse-detection needs the token to be resolvable by hash
// BEFORE the request's tenant is known (POST /v1/auth/refresh only ever
// carries the opaque token itself) — the exact same problem
// resolve_device_by_api_key_id (AddDeviceApiKey migration) and
// resolve_person_by_cpf (AddAuthAndPermissionGroups migration) already
// solved. This migration adds the same narrowly-scoped SECURITY DEFINER
// escape hatch rather than a blanket cross-tenant grant, so Backend Agent
// has a sanctioned way to look up a presented token before `app.tenant_id`
// is set.
export class AddRefreshToken1755842000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE refresh_token (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        token_hash varchar(128) NOT NULL,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        replaced_by_token_id uuid REFERENCES refresh_token(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT refresh_token_token_hash_unique UNIQUE (token_hash)
      )
    `);

    // Revoke-all-for-person (password change / logout-all, per the confirmed
    // design) scans every outstanding token for a person_id.
    await queryRunner.query(`
      CREATE INDEX refresh_token_person_id_idx ON refresh_token (person_id)
    `);

    await queryRunner.query('ALTER TABLE refresh_token ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE refresh_token FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON refresh_token
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_token TO ${appDbUsername}`);

    // Same pattern as resolve_device_by_api_key_id / resolve_person_by_cpf:
    // login/refresh happens before any tenant context exists, so the
    // token-hash -> {refresh token, tenant, person} lookup needs a narrow
    // SECURITY DEFINER function rather than a blanket cross-tenant SELECT
    // grant on refresh_token.
    await queryRunner.query(`
      CREATE FUNCTION resolve_refresh_token_by_hash(p_token_hash varchar)
      RETURNS TABLE (
        refresh_token_id uuid,
        tenant_id uuid,
        person_id uuid,
        expires_at timestamptz,
        revoked_at timestamptz,
        replaced_by_token_id uuid
      )
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT id, tenant_id, person_id, expires_at, revoked_at, replaced_by_token_id
        FROM refresh_token
        WHERE token_hash = p_token_hash
      $$;
    `);
    await queryRunner.query('REVOKE ALL ON FUNCTION resolve_refresh_token_by_hash(varchar) FROM PUBLIC');
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION resolve_refresh_token_by_hash(varchar) TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP FUNCTION IF EXISTS resolve_refresh_token_by_hash(varchar)');
    await queryRunner.query('DROP TABLE IF EXISTS refresh_token CASCADE');
  }
}
