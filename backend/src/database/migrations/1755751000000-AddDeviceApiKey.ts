import { MigrationInterface, QueryRunner } from 'typeorm';

// Device -> Gateway authentication (per-device API key, approved 2026-08-21).
// The auth lookup happens BEFORE the request's tenant is known, so it can't
// go through the normal RLS-scoped app role. Rather than grant checkclass_app
// a blanket cross-tenant SELECT on `device`, this migration adds a narrow
// SECURITY DEFINER function that only ever returns the columns needed to
// authenticate — the sole sanctioned way to cross the tenant boundary.
export class AddDeviceApiKey1755751000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE device
        ADD COLUMN api_key_id varchar(64),
        ADD COLUMN api_key_secret_hash varchar(128),
        ADD COLUMN api_key_created_at timestamptz NOT NULL DEFAULT now()
    `);
    await queryRunner.query(`
      ALTER TABLE device ALTER COLUMN api_key_id SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE device ALTER COLUMN api_key_secret_hash SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE device ADD CONSTRAINT device_api_key_id_unique UNIQUE (api_key_id)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`
      CREATE FUNCTION resolve_device_by_api_key_id(p_api_key_id varchar)
      RETURNS TABLE (device_id uuid, tenant_id uuid, api_key_secret_hash varchar, status varchar)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT id, tenant_id, api_key_secret_hash, status
        FROM device
        WHERE api_key_id = p_api_key_id
      $$;
    `);
    await queryRunner.query(`REVOKE ALL ON FUNCTION resolve_device_by_api_key_id(varchar) FROM PUBLIC`);
    await queryRunner.query(
      `GRANT EXECUTE ON FUNCTION resolve_device_by_api_key_id(varchar) TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP FUNCTION IF EXISTS resolve_device_by_api_key_id(varchar)');
    await queryRunner.query('ALTER TABLE device DROP CONSTRAINT IF EXISTS device_api_key_id_unique');
    await queryRunner.query(`
      ALTER TABLE device
        DROP COLUMN IF EXISTS api_key_id,
        DROP COLUMN IF EXISTS api_key_secret_hash,
        DROP COLUMN IF EXISTS api_key_created_at
    `);
  }
}
