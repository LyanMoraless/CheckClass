import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-03: introduces Matéria (Subject) as a new entity between Curso
// and Turma — same field shape as Curso, confirmed by the user's
// third-round update (name required, code optional; workload/ementa
// explicitly out of scope this round).
//
// This migration only creates the table. MigrateClassGroupToSubject (next
// migration) backfills class_group.subjectId off of it and drops
// class_group.course_id — split into two migrations so the "create new
// concept" step and the "cut over/backfill existing data" step can be
// reasoned about and rolled back independently.
export class AddSubject1755853000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE subject (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        course_id uuid NOT NULL REFERENCES course(id),
        name varchar(255) NOT NULL,
        code varchar(50),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Supports "list subjects for course X" (Cadastro de informações screen)
    // and the course-derivation join that replaces every place class_group
    // used to read course_id directly (class_group -> subject -> course_id).
    await queryRunner.query('CREATE INDEX subject_course_id_idx ON subject (course_id)');

    await queryRunner.query('ALTER TABLE subject ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE subject FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON subject
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON subject TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS subject CASCADE');
  }
}
