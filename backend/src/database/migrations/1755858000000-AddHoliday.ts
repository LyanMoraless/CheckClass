import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-04 (second and third-round updates) + the approved
// architecture's explicit closure ("Escopo do feriado: institucional"): a
// holiday applies to the whole institution, not a room/turma, so it is
// tenant-scoped only — no class_group_id/room_id. UNIQUE (tenant_id, date)
// reflects that a calendar date either is a holiday for the institution or
// it isn't; there is no meaningful case for two holiday rows on the same
// date for the same tenant.
export class AddHoliday1755858000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE holiday (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        date date NOT NULL,
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, date)
      )
    `);

    await queryRunner.query('ALTER TABLE holiday ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE holiday FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON holiday
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON holiday TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS holiday CASCADE');
  }
}
