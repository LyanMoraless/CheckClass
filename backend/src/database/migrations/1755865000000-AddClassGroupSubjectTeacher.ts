import { MigrationInterface, QueryRunner } from 'typeorm';

// Frente 07 — RULE-JUST-24's blocking dependency. Before this migration the
// schema could answer "does this person teach in this turma"
// (class_group_enrollment) and "which matérias does this turma have"
// (class_group_subject), but never "does this person teach THIS matéria in
// THIS turma" — the exact fact RULE-JUST-08/24 need to gate attachment
// access, legal category and rejection motivo without falling back to
// LeadershipScopeService's leadership-chain walk, which those same rules
// deliberately exclude.
//
// A new junction, not an extension of either existing table — see the
// entity's header comment (class-group-subject-teacher.entity.ts) for the
// full reasoning (co-docência per matéria, one teacher across several
// matérias, same relational idiom already used by class_group_enrollment/
// class_group_subject: an explicit junction table, never an array/jsonb of
// ids).
//
// class_group_id/subject_id are direct FKs, not a FK to class_group_subject
// — the query this table answers ("é o professor responsável por esta
// matéria, nesta turma") is a flat WHERE on these two columns plus
// person_id, fully covered left-to-right by the UNIQUE index below; no
// separate index is created for it (same reasoning already applied to
// attendance_frequency_warning's uniqueness index).
//
// Starts EMPTY, by design. Populating "who teaches what matéria" has no
// administrative flow yet (RULE-INST-05 only assigns a teacher to a whole
// turma) — building that screen was explicitly kept out of Frente 07's
// scope by the user; this round it is populated manually/by script.
// Whoever implements "remove a matéria from a turma" (the narrower sibling
// of ClassGroupDeletionOrchestrator flagged in architecture-overview.md)
// must also delete this table's rows for the (class_group_id, subject_id)
// pair being removed — nothing here cascades that automatically, because
// the FKs target plain columns, not class_group_subject.id.
export class AddClassGroupSubjectTeacher1755865000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`
      CREATE TABLE class_group_subject_teacher (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        subject_id uuid NOT NULL REFERENCES subject(id),
        person_id uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT class_group_subject_teacher_unique UNIQUE (class_group_id, subject_id, person_id)
      )
    `);

    // The professor's own "which turmas/matérias do I teach" listing —
    // the UNIQUE index above starts with (class_group_id, subject_id), which
    // does not serve a person_id-first lookup.
    await queryRunner.query(`
      CREATE INDEX class_group_subject_teacher_person_idx
      ON class_group_subject_teacher (tenant_id, person_id)
    `);

    await queryRunner.query('ALTER TABLE class_group_subject_teacher ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE class_group_subject_teacher FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON class_group_subject_teacher
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON class_group_subject_teacher TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS class_group_subject_teacher CASCADE');
  }
}
