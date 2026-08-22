import { MigrationInterface, QueryRunner } from 'typeorm';

// Priority 2 (Gerenciamento da Instituição) kickoff, confirmed 2026-08-22:
// human login is unified on CPF (globally unique per real person — RA was
// dropped specifically because it's only unique within one institution,
// which made "which tenant is this login for" ambiguous). Permissions are
// configurable groups (root admin + institution-defined groups), NOT the
// same mechanism as RULE-ATT-12's leadership chain — the two coexist:
// leadership_assignment stays the specific authority for resolving
// attendance pending reviews; permission groups cover general institutional
// management (users, attendance config, register, institution structure).
export class AddAuthAndPermissionGroups1755840000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE person_credential (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL UNIQUE REFERENCES person(id),
        cpf varchar(11) NOT NULL UNIQUE,
        password_hash varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE permission_group (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE permission_group_permission (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        permission_group_id uuid NOT NULL REFERENCES permission_group(id),
        permission_code varchar(50) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (permission_group_id, permission_code)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE person_permission_group (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        permission_group_id uuid NOT NULL REFERENCES permission_group(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (person_id, permission_group_id)
      )
    `);

    for (const table of ['person_credential', 'permission_group', 'permission_group_permission', 'person_permission_group']) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    for (const table of ['person_credential', 'permission_group', 'permission_group_permission', 'person_permission_group']) {
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${appDbUsername}`);
    }

    // Same pattern as resolve_device_by_api_key_id (AddDeviceApiKey
    // migration): login happens before any tenant context exists, so the
    // CPF -> {person, tenant} lookup needs a narrowly-scoped SECURITY
    // DEFINER escape hatch rather than a blanket cross-tenant grant.
    await queryRunner.query(`
      CREATE FUNCTION resolve_person_by_cpf(p_cpf varchar)
      RETURNS TABLE (person_id uuid, tenant_id uuid, password_hash varchar)
      LANGUAGE sql
      SECURITY DEFINER
      SET search_path = public, pg_temp
      AS $$
        SELECT person_id, tenant_id, password_hash
        FROM person_credential
        WHERE cpf = p_cpf
      $$;
    `);
    await queryRunner.query('REVOKE ALL ON FUNCTION resolve_person_by_cpf(varchar) FROM PUBLIC');
    await queryRunner.query(`GRANT EXECUTE ON FUNCTION resolve_person_by_cpf(varchar) TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP FUNCTION IF EXISTS resolve_person_by_cpf(varchar)');
    for (const table of ['person_permission_group', 'permission_group_permission', 'permission_group', 'person_credential']) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }
}
