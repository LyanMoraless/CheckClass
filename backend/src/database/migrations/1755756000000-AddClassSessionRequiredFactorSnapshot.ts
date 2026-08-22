import { MigrationInterface, QueryRunner } from 'typeorm';

// class_session already snapshots min%/tolerance/post-tolerance-behavior
// (RULE-ATT-04/05) so a later config change can't retroactively regrade a
// past session — but the originally approved model never snapshotted WHICH
// factors were required at that time (only the config's numeric values).
// Required factors are just as decisive for grading (RULE-ATT-07) as the
// percentage/tolerance, so this closes that gap the same way: freeze the
// required-factor set at session-creation time.
export class AddClassSessionRequiredFactorSnapshot1755756000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE class_session_required_factor (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_session_id uuid NOT NULL REFERENCES class_session(id),
        attendance_factor_type_id uuid NOT NULL REFERENCES attendance_factor_type(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (class_session_id, attendance_factor_type_id)
      )
    `);
    await queryRunner.query('ALTER TABLE class_session_required_factor ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE class_session_required_factor FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON class_session_required_factor
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON class_session_required_factor TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS class_session_required_factor CASCADE');
  }
}
