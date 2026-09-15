import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-PRES-01/09, from the schema approved by the user 2026-09-15
// ("Desenho de schema — Localização, timeout de afastamento e responsável
// legal", item 5, architecture-overview.md). Singleton per tenant
// (tenant_id UNIQUE) — confirmed by the user that no client institution has
// more than one physically distant address, ruling out the N-per-tenant
// shape used by institutional_network_range. Not merged into
// device_binding_config or attendance_config (different domains: geographic
// identity vs. session hygiene vs. grading policy). No PostGIS/geography —
// no evidence of need, simple radius math is enough; "is this point inside
// the radius" is a pure function at the decision layer (login RULE-PRES-01,
// monitoring RULE-PRES-09), not modeled here or at ingestion time.
export class AddInstitutionalLocationConfig1755876000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`
      CREATE TABLE institutional_location_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL UNIQUE REFERENCES tenant(id),
        latitude numeric(9,6) NOT NULL,
        longitude numeric(9,6) NOT NULL,
        radius_meters int NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- Database Agent integrity decision, same precedent as
        -- device_binding_config.inactivity_timeout_minutes_check: not a
        -- business rule, just ruling out a nonsensical zero/negative radius.
        CONSTRAINT institutional_location_config_radius_meters_check CHECK (radius_meters > 0)
      )
    `);

    await queryRunner.query('ALTER TABLE institutional_location_config ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE institutional_location_config FORCE ROW LEVEL SECURITY');
    // RLS simple por tenant, sem restrição de admin técnico — não é dado
    // sensível de indivíduo, é config institucional (Solution Architect,
    // 2026-09-15).
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON institutional_location_config
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON institutional_location_config TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS institutional_location_config CASCADE');
  }
}
