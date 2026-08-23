import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-ACC-02's concrete schema link, confirmed as a real gap in
// pending-decisions.md ("Gap — Vínculo categoria de pulseira -> área
// (schema)"): a wristband category grants access to one or more areas
// (RULE-ACC-02: "área, bloco, período"), optionally bounded by a validity
// window (the "período" part of the rule — e.g. a visitor pass valid only
// for a specific date range). This is also the concrete authorization
// primitive RULE-SEC-01's note names for defining "unauthorized person": a
// person is authorized in an area when their wristband's category has a
// permission row here for that area (or an ancestor area in the `area`
// hierarchy — containment resolution is the Serviço de Autorização de
// Área's job, not enforced by this table).
//
// valid_from/valid_until model an absolute date/time window, not a
// recurring weekly schedule (e.g. "Mon-Fri 08:00-18:00") — the only
// concrete example of "período" in RULE-ACC-02's source (visitor access
// valid for an authorized period) reads as an absolute window, and no rule
// text confirms a recurring-schedule requirement. If a recurring schedule
// is needed later, that is a new column set on this same table, not a
// reinterpretation of these two.
export class AddWristbandCategoryAreaPermission1755847000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE wristband_category_area_permission (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        wristband_category_id uuid NOT NULL REFERENCES wristband_category(id),
        area_id uuid NOT NULL REFERENCES area(id),
        valid_from timestamptz,
        valid_until timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT wristband_category_area_permission_window_check
          CHECK (valid_from IS NULL OR valid_until IS NULL OR valid_until > valid_from)
      )
    `);

    // Primary access pattern for the Serviço de Autorização de Área: "does
    // categoryId have a permission covering areaId (at time T)".
    await queryRunner.query(`
      CREATE INDEX wristband_category_area_permission_lookup_idx
      ON wristband_category_area_permission (wristband_category_id, area_id)
    `);

    await queryRunner.query('ALTER TABLE wristband_category_area_permission ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE wristband_category_area_permission FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON wristband_category_area_permission
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON wristband_category_area_permission TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS wristband_category_area_permission CASCADE');
  }
}
