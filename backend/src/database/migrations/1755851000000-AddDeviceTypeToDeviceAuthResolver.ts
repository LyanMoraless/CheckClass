import { MigrationInterface, QueryRunner } from 'typeorm';

// Device-type enforcement (security hardening, approved 2026-08-23):
// resolve_device_by_api_key_id() only ever returned enough to authenticate
// (device_id/tenant_id/secret hash/status) — device_type was never part of
// its contract, so DeviceAuthGuard had no way to check it after
// authentication succeeded. One device-auth mechanism now spans two domains
// of differing sensitivity (attendance ingestion, security ingestion), so
// device_type needs to become an enforced capability boundary
// (@RequireDeviceType, checked in DeviceAuthGuard), not just descriptive
// metadata. This migration adds device_type to the SECURITY DEFINER
// function's return shape — DROP + CREATE, not CREATE OR REPLACE, since
// RETURNS TABLE's column list is changing, which CREATE OR REPLACE FUNCTION
// cannot do in Postgres.
export class AddDeviceTypeToDeviceAuthResolver1755851000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query('DROP FUNCTION IF EXISTS resolve_device_by_api_key_id(varchar)');
    await queryRunner.query(`
      CREATE FUNCTION resolve_device_by_api_key_id(p_api_key_id varchar)
      RETURNS TABLE (device_id uuid, tenant_id uuid, device_type varchar, api_key_secret_hash varchar, status varchar)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT id, tenant_id, device_type, api_key_secret_hash, status
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
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query('DROP FUNCTION IF EXISTS resolve_device_by_api_key_id(varchar)');
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
}
