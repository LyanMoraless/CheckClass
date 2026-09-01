import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-03: the rule's own text explicitly leaves the migration
// strategy for existing data to the Database Agent. `class_group.course_id`
// today points directly at `course`; the approved architecture requires
// class_group to reference `subject_id` instead, with course derived only
// via `subject.course_id` (never duplicated onto class_group,
// architecture-overview.md).
//
// Migration strategy (this is a pre-production schema — no real tenant data
// exists yet, per the Orchestrator's task framing — so simplicity/data-
// preservation is favored over a zero-downtime multi-phase rollout): for
// every distinct course actually referenced by an existing class_group row,
// create exactly one "placeholder" subject that clones that course's
// name/code 1:1 (so no academic-structure information is lost or invented),
// point every affected class_group at that placeholder subject, then drop
// course_id. Institutions can freely rename/split/reorganize the
// placeholder subjects (or add real ones) afterward through the normal
// Subject CRUD — this migration's only job is to not lose or corrupt
// existing course/turma links.
export class MigrateClassGroupToSubject1755854000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO subject (id, tenant_id, course_id, name, code)
      SELECT gen_random_uuid(), c.tenant_id, c.id, c.name, c.code
      FROM course c
      WHERE c.id IN (SELECT DISTINCT course_id FROM class_group)
    `);

    await queryRunner.query('ALTER TABLE class_group ADD COLUMN subject_id uuid');

    await queryRunner.query(`
      UPDATE class_group cg
      SET subject_id = s.id
      FROM subject s
      WHERE s.course_id = cg.course_id
    `);

    await queryRunner.query('ALTER TABLE class_group ALTER COLUMN subject_id SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE class_group
      ADD CONSTRAINT class_group_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subject(id)
    `);
    await queryRunner.query('CREATE INDEX class_group_subject_id_idx ON class_group (subject_id)');

    await queryRunner.query('ALTER TABLE class_group DROP COLUMN course_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE class_group ADD COLUMN course_id uuid');

    await queryRunner.query(`
      UPDATE class_group cg
      SET course_id = s.course_id
      FROM subject s
      WHERE s.id = cg.subject_id
    `);

    await queryRunner.query('ALTER TABLE class_group ALTER COLUMN course_id SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE class_group
      ADD CONSTRAINT class_group_course_id_fkey FOREIGN KEY (course_id) REFERENCES course(id)
    `);

    await queryRunner.query('DROP INDEX IF EXISTS class_group_subject_id_idx');
    await queryRunner.query('ALTER TABLE class_group DROP CONSTRAINT IF EXISTS class_group_subject_id_fkey');
    await queryRunner.query('ALTER TABLE class_group DROP COLUMN IF EXISTS subject_id');

    // Deliberately does not delete the placeholder subject rows created by
    // up() — they belong to the `subject` table's own lifecycle (AddSubject
    // migration), and by the time this runs they may have been renamed/
    // reused by real Subject CRUD activity. Same reversibility scope as the
    // rest of this codebase's down() migrations (structural reversal, not a
    // full data-state rollback).
  }
}
