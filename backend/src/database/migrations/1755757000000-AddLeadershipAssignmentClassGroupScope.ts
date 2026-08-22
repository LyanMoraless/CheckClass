import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-ATT-12 literally scopes resolution authority to "a aula/turma em
// questão" (the specific class/session in question) — the original schema
// only scoped leadership_assignment by course, which over-authorizes: any
// role tied to a course could resolve pending reviews for every class_group
// under it. Adds an optional, more specific class_group_id: NULL means the
// assignment applies to the whole course (or, combined with a NULL
// course_id too, the whole institution) — same nullable-scope pattern
// already used by attendance_config.
export class AddLeadershipAssignmentClassGroupScope1755757000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE leadership_assignment
        ADD COLUMN class_group_id uuid REFERENCES class_group(id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE leadership_assignment DROP COLUMN IF EXISTS class_group_id');
  }
}
