import { MigrationInterface, QueryRunner } from 'typeorm';

// Frente 06 — aviso de frequência acumulada (RULE-FREQ-03/04/07/08),
// approved design in architecture-overview.md, "Addendum à Decisão de
// arquitetura — Frequência acumulada e aviso de limite, Frente 06, segunda
// rodada", section A. One table, one discriminator column, no history: the
// business explicitly refused a warning history (RULE-FREQ-04 addendum a — a
// warning that stops applying disappears "as if it had never been issued").
//
// `warning_type` is deliberately OUT of the uniqueness key. The two types
// are mutually exclusive by construction — after rounding, `p < min` is
// `below_minimum` and `min <= p <= min+10` is `approaching_minimum`, two
// disjoint ranges — and RULE-FREQ-07 forbids showing both at once for the
// same matéria. Keying on (tenant, person, class_group, subject) WITHOUT the
// type turns that exclusivity into a database invariant instead of code
// discipline: a type transition is an UPDATE of the same row (which also
// resets `seen_at`, so the student is notified of the new, more serious
// warning), never a second row.
//
// Key includes `class_group_id`, not just (person, subject): both the
// reporting window (`class_group.term_start_date/term_end_date`, sliced by
// the pure function of the approved technology decision) and the effective
// configuration (attendance_config resolved institution→course→class_group)
// come from the turma, so the same matéria in two turmas is two distinct
// realities, not one row.
//
// `frequency_percentage` is smallint and stores the ROUNDED value —
// deliberately divergent from `session_attendance_consolidation
// .attendance_percentage numeric(5,2)` of Controle A, and NOT an oversight to
// "fix" later for symmetry. Controle A persists a MEASUREMENT (how much of a
// class the student attended); this column persists an ALREADY-NORMALIZED
// DECISION INPUT: RULE-FREQ-05.3 says both comparisons (against the minimum
// and against the minimum + 10 p.p.) use the rounded integer, so the rounded
// integer IS the value the system acted on. Persisting the raw value too
// would create two truths and let the UI show "69,6%" while the system
// treats the student as 70%. Nothing is lost: `present_count` /
// `considered_count` are stored alongside, so the raw ratio is always
// rederivable and the UI has the good message ("33 de 40 aulas").
//
// `min_percentage_applied` snapshots the Controle B minimum
// (`attendance_config.min_accumulated_frequency_percentage`) that was in
// force when the row was last written, so an old warning stays explainable
// if the configuration changes. It is a record of what happened, NOT a
// configuration snapshot to read from: Controle B always resolves the
// configuration live at calculation time (see the entity comment and section
// D/F3 of the addendum).
//
// The status/resolution CHECK trio, the partial unique index and the
// RLS/FORCE RLS/policy/GRANT block copy the intrusion_incident precedent
// (1755849000000-AddIntrusionIncident.ts, lines 75-101) literally — nothing
// invented here.
//
// `resolution_reason` has a closed vocabulary of exactly three persisted
// values, one per confirmed outcome that ENDS a warning as `resolved`:
// `subject_removed_from_class_group` (RULE-FREQ-04 addendum c),
// `period_closed` (RULE-FREQ-08.1) and `enrollment_inactive`
// (RULE-FREQ-08.2). The fourth confirmed outcome — the frequency went back
// up (RULE-FREQ-04 addendum a) — is a physical DELETE of the row and
// therefore never produces a `resolution_reason`.
//
// FK note for whoever touches turma deletion: because class_group_id is a
// real FK, `ClassGroupDeletionOrchestratorService.deleteClassGroupUnchecked`
// must DELETE this table's rows for the turma (physical delete — the turma
// ceased to exist), or the FK blocks the deletion.
export class AddAttendanceFrequencyWarning1755864000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE attendance_frequency_warning (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        subject_id uuid NOT NULL REFERENCES subject(id),
        warning_type varchar(30) NOT NULL,
        warning_type_since timestamptz NOT NULL DEFAULT now(),
        frequency_percentage smallint NOT NULL,
        present_count int NOT NULL,
        considered_count int NOT NULL,
        min_percentage_applied numeric(5,2) NOT NULL,
        period_start_date date NOT NULL,
        period_end_date date NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        resolved_at timestamptz,
        resolution_reason varchar(40),
        seen_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT attendance_frequency_warning_type_check
          CHECK (warning_type IN ('approaching_minimum', 'below_minimum')),
        CONSTRAINT attendance_frequency_warning_status_check
          CHECK (status IN ('active', 'resolved')),
        CONSTRAINT attendance_frequency_warning_resolution_reason_check
          CHECK (
            resolution_reason IS NULL
            OR resolution_reason IN ('subject_removed_from_class_group', 'period_closed', 'enrollment_inactive')
          ),
        CONSTRAINT attendance_frequency_warning_resolution_check CHECK (
          (status = 'active' AND resolved_at IS NULL AND resolution_reason IS NULL)
          OR
          (status = 'resolved' AND resolved_at IS NOT NULL AND resolution_reason IS NOT NULL)
        )
      )
    `);

    // RULE-FREQ-07 / RULE-FREQ-04 item 4 as a database invariant: at most one
    // ACTIVE warning per (person, turma, matéria), whatever its type. Same
    // shape as intrusion_incident_one_open_per_tenant.
    //
    // This index is also the read index for GET /v1/me/warnings: that
    // endpoint filters (tenant_id, person_id) with status = 'active' every
    // 60s per logged-in student, which is exactly this index's leading
    // prefix under its own partial predicate. A separate
    // (tenant_id, person_id) WHERE status='active' index would be strictly
    // redundant with it — same precedent already applied in
    // AddClassGroupSubjects (no separate class_group_id index next to the
    // UNIQUE (class_group_id, subject_id)).
    await queryRunner.query(`
      CREATE UNIQUE INDEX attendance_frequency_warning_one_active_per_subject
      ON attendance_frequency_warning (tenant_id, person_id, class_group_id, subject_id)
      WHERE status = 'active'
    `);

    await queryRunner.query('ALTER TABLE attendance_frequency_warning ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE attendance_frequency_warning FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON attendance_frequency_warning
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_frequency_warning TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS attendance_frequency_warning CASCADE');
  }
}
