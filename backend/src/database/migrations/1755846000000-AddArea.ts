import { MigrationInterface, QueryRunner } from 'typeorm';

// Security Intrusion, first round (Solution Architect decision approved
// 2026-08-23; schema gap explicitly left open to the Database Agent — see
// "Gap — Vínculo categoria de pulseira -> área (schema)" in
// pending-decisions.md). RULE-SEC-01's note confirms detection must operate
// at "bloco/edifício" granularity, and RULE-SEC-02 requires estimating
// andar/região/corredor — coarser than `room`, which is flat and only
// serves attendance (class_session.room_id). Rather than bolt floor/
// building columns onto `room` (which would conflate an attendance-facing
// concept with a security-facing one) or hardcode two separate `area` and
// `bloco` tables (RULE-ACC-02 names them as two granularities of the same
// underlying idea, not two disjoint concepts), this migration introduces a
// single self-referencing `area` table: a top-level row (parent_area_id
// NULL) models a "bloco"; a row with parent_area_id set models a nested
// "área/andar/corredor" inside it. This is deliberately open-depth (not
// hardcoded to exactly two levels) so a future institution with a deeper
// hierarchy (bloco -> andar -> corredor) is not blocked, and it gives the
// Serviço de Autorização de Área and the future RULE-SEC-04 lockdown
// consumer one consistent containment concept to query, instead of two.
//
// `room` gets an optional area_id: a room (attendance-facing) can now
// optionally sit inside a coarser area (security-facing) so IR barriers/
// cameras mapped to that area implicitly cover the rooms within it. This is
// additive and nullable — every existing room gets area_id = NULL, no
// behavioral change to the attendance pipeline (class_session, presence
// rules, etc. never read this column).
export class AddArea1755846000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE area (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        parent_area_id uuid REFERENCES area(id),
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Hierarchy traversal (containment checks done by the Serviço de
    // Autorização de Área, e.g. "does this permission's area contain the
    // detected area").
    await queryRunner.query(`
      CREATE INDEX area_parent_area_id_idx ON area (parent_area_id)
    `);

    await queryRunner.query('ALTER TABLE area ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE area FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON area
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON area TO ${appDbUsername}`);

    await queryRunner.query(`
      ALTER TABLE room ADD COLUMN area_id uuid REFERENCES area(id)
    `);
    await queryRunner.query(`
      CREATE INDEX room_area_id_idx ON room (area_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS room_area_id_idx');
    await queryRunner.query('ALTER TABLE room DROP COLUMN IF EXISTS area_id');
    await queryRunner.query('DROP TABLE IF EXISTS area CASCADE');
  }
}
