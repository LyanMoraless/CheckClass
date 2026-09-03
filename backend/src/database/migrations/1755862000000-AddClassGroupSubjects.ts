import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-14 / Frente 05 (architecture-overview.md, "Decisão de arquitetura
// — Turma com várias matérias"): a Turma stops being "an offering of ONE
// Subject" and becomes a cohort that studies N subjects. `class_group
// .subject_id` is replaced by the `class_group_subject` junction table, and
// the "which subject is this?" question moves down to the two places that can
// actually answer it per occurrence — the recurring slot and the concrete
// session, both of which get their own direct `subject_id` FK.
//
// `class_group.course_id` comes back (it existed before
// MigrateClassGroupToSubject, which dropped it in favor of deriving course
// via subject.course_id). It is NOT redundant denormalization anymore: with
// zero-subject turmas being a valid, user-confirmed state (a turma survives
// the deletion of its last matéria — RULE-INST-08 addendum), course can no
// longer be derived from the subject set at all, and RULE-INST-09's whole
// authorization model (leadership_assignment.course_id) needs a course for
// every turma, including an empty one — otherwise nobody could ever add a
// matéria back to it. The turma's course is therefore first-class data, and
// every subject linked to a turma must belong to that same course
// (application-level invariant, ClassGroupService).
//
// Data migration (same pre-production framing and Database-Agent scope as
// MigrateClassGroupToSubject before it): each existing turma keeps exactly
// what it has today, expressed in the new shape — its single subject becomes
// its only class_group_subject row, its course becomes class_group.course_id,
// and every existing slot/session inherits that same subject_id. Logically
// univocal, nothing invented, nothing lost.
export class AddClassGroupSubjects1755862000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    // 1. class_group.course_id — the turma's own course (see header).
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
    await queryRunner.query('CREATE INDEX class_group_course_id_idx ON class_group (course_id)');

    // 2. class_group_subject — the N:N itself. Same relational shape as the
    // other junction tables in this schema (class_group_enrollment,
    // wristband_category_area_permission): an explicit table, never an
    // array/jsonb column of ids.
    await queryRunner.query(`
      CREATE TABLE class_group_subject (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        subject_id uuid NOT NULL REFERENCES subject(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT class_group_subject_unique UNIQUE (class_group_id, subject_id)
      )
    `);
    // Primary access pattern: "which matérias does this turma have"
    // (montar-turma screen, slot validation). The UNIQUE constraint above
    // already indexes (class_group_id, subject_id) left-to-right, so no
    // separate class_group_id index is created.
    await queryRunner.query('CREATE INDEX class_group_subject_subject_id_idx ON class_group_subject (subject_id)');

    await queryRunner.query('ALTER TABLE class_group_subject ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE class_group_subject FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON class_group_subject
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON class_group_subject TO ${appDbUsername}`);

    await queryRunner.query(`
      INSERT INTO class_group_subject (id, tenant_id, class_group_id, subject_id)
      SELECT gen_random_uuid(), cg.tenant_id, cg.id, cg.subject_id
      FROM class_group cg
    `);

    // 3. The recurring slot now says which matéria it teaches — this is what
    // makes a Mon/Wed turma able to have Matemática on Monday and Física on
    // Wednesday. FK points straight at subject (not at class_group_subject):
    // "which subject is this slot" is a direct property of the row, and a
    // direct FK keeps historical sessions readable even after a matéria is
    // unlinked from the turma.
    await queryRunner.query('ALTER TABLE class_group_schedule_slot ADD COLUMN subject_id uuid');
    await queryRunner.query(`
      UPDATE class_group_schedule_slot slot
      SET subject_id = cg.subject_id
      FROM class_group cg
      WHERE cg.id = slot.class_group_id
    `);
    await queryRunner.query('ALTER TABLE class_group_schedule_slot ALTER COLUMN subject_id SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE class_group_schedule_slot
      ADD CONSTRAINT class_group_schedule_slot_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subject(id)
    `);
    await queryRunner.query(
      'CREATE INDEX class_group_schedule_slot_subject_id_idx ON class_group_schedule_slot (subject_id)',
    );

    // 4. Same for the concrete session — RULE-FREQ-01 (frequência por
    // matéria) and RULE-JUST-02 (filtro de matérias do dia) read this column
    // directly instead of joining up to class_group.
    await queryRunner.query('ALTER TABLE class_session ADD COLUMN subject_id uuid');
    await queryRunner.query(`
      UPDATE class_session cs
      SET subject_id = cg.subject_id
      FROM class_group cg
      WHERE cg.id = cs.class_group_id
    `);
    await queryRunner.query('ALTER TABLE class_session ALTER COLUMN subject_id SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE class_session
      ADD CONSTRAINT class_session_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subject(id)
    `);
    await queryRunner.query('CREATE INDEX class_session_subject_id_idx ON class_session (subject_id)');

    // 5. Only now that everything has been derived from it: the old single
    // subject link disappears.
    await queryRunner.query('DROP INDEX IF EXISTS class_group_subject_id_idx');
    await queryRunner.query('ALTER TABLE class_group DROP CONSTRAINT IF EXISTS class_group_subject_id_fkey');
    await queryRunner.query('ALTER TABLE class_group DROP COLUMN subject_id');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // A turma with zero (or several) matérias simply has no representation in
    // the old one-subject-per-turma schema. Rather than silently picking a
    // winner or destroying turmas, this fails loudly and leaves the database
    // untouched — the only honest reversal of a model that is strictly wider
    // than the one it replaced.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM class_group cg
          LEFT JOIN class_group_subject cgs ON cgs.class_group_id = cg.id
          GROUP BY cg.id
          HAVING count(cgs.id) <> 1
        ) THEN
          RAISE EXCEPTION 'cannot roll back AddClassGroupSubjects: at least one class_group has zero or multiple subjects, which the previous single-subject schema cannot represent';
        END IF;
      END $$
    `);

    await queryRunner.query('ALTER TABLE class_group ADD COLUMN subject_id uuid');
    await queryRunner.query(`
      UPDATE class_group cg
      SET subject_id = cgs.subject_id
      FROM class_group_subject cgs
      WHERE cgs.class_group_id = cg.id
    `);
    await queryRunner.query('ALTER TABLE class_group ALTER COLUMN subject_id SET NOT NULL');
    await queryRunner.query(`
      ALTER TABLE class_group
      ADD CONSTRAINT class_group_subject_id_fkey FOREIGN KEY (subject_id) REFERENCES subject(id)
    `);
    await queryRunner.query('CREATE INDEX class_group_subject_id_idx ON class_group (subject_id)');

    await queryRunner.query('DROP INDEX IF EXISTS class_session_subject_id_idx');
    await queryRunner.query('ALTER TABLE class_session DROP CONSTRAINT IF EXISTS class_session_subject_id_fkey');
    await queryRunner.query('ALTER TABLE class_session DROP COLUMN IF EXISTS subject_id');

    await queryRunner.query('DROP INDEX IF EXISTS class_group_schedule_slot_subject_id_idx');
    await queryRunner.query(
      'ALTER TABLE class_group_schedule_slot DROP CONSTRAINT IF EXISTS class_group_schedule_slot_subject_id_fkey',
    );
    await queryRunner.query('ALTER TABLE class_group_schedule_slot DROP COLUMN IF EXISTS subject_id');

    await queryRunner.query('DROP TABLE IF EXISTS class_group_subject CASCADE');

    await queryRunner.query('DROP INDEX IF EXISTS class_group_course_id_idx');
    await queryRunner.query('ALTER TABLE class_group DROP CONSTRAINT IF EXISTS class_group_course_id_fkey');
    await queryRunner.query('ALTER TABLE class_group DROP COLUMN IF EXISTS course_id');
  }
}
