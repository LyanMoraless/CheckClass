import { MigrationInterface, QueryRunner } from 'typeorm';

// Frente 06 / Controle B — the two configuration parameters the accumulated
// frequency control needs, both landing on the existing attendance_config
// table so they inherit its institution→course→class_group scope resolution
// instead of duplicating that mechanism (approved architecture,
// architecture-overview.md: "Decisão de arquitetura — Frequência acumulada e
// aviso de limite, Frente 06" + "Addendum … segunda rodada", resposta 1/F1,
// + "Nota de implementação (2026-09-03) — nome técnico do campo de período de
// apuração").
//
// 1. min_accumulated_frequency_percentage (RULE-FREQ-01 addendum) — the
//    Controle B minimum. It deliberately does NOT reuse
//    `min_attendance_percentage`; do not "simplify" this later by unifying
//    the two:
//
//    - `min_attendance_percentage` (Controle A, RULE-ATT-04) means
//      "percentage of ONE session the student must stay in to be marked
//      present in that session" — read by AttendanceRulesEngineService
//      against the per-session snapshot
//      (`class_session.min_attendance_percentage_snapshot`).
//    - `min_accumulated_frequency_percentage` (Controle B) means "percentage
//      of the reporting period's classes the student must attend in order not
//      to fail by absence". RULE-FREQ-03's +10 p.p. warning trigger and
//      RULE-FREQ-07's "already below the minimum" comparison hang on it.
//
//    They answer unrelated questions ("stayed 75% of the class" vs "attended
//    75% of the classes"). RULE-FREQ-01's addendum is explicit that the two
//    parameters are independent, that the SAME institution may set different
//    values for each, and that neither derives a default from the other.
//    Collapsing them back into one column would silently make one number
//    serve two semantics.
//
// 2. accumulated_frequency_period (RULE-FREQ-02) — the reporting period the
//    accumulated frequency is measured over. Closed vocabulary of three
//    values as varchar + CHECK, never a native ENUM: the schema uses
//    varchar + CHECK in 100% of the analogous cases
//    (`session_attendance_consolidation.status`, `class_session.status`,
//    `enrollment_status`, `post_tolerance_behavior`), and `ALTER TYPE ADD
//    VALUE` is operationally worse. Mapping to the slicing function of the
//    approved technology decision: `bimester` = 2 calendar months,
//    `trimester` = 3, `semester` = 6, sliced from
//    `class_group.term_start_date`, with the last slice absorbing the
//    remainder (and the whole term becoming a single slice when the
//    configured period is longer than the term). No academic-calendar table
//    exists or is to be created — the boundaries are computed, not stored.
//
// Both columns mirror `min_attendance_percentage`'s shape decisions — NOT
// NULL, no DB default — on purpose: TenantConfigService's scope resolution
// picks the most specific attendance_config ROW as a whole, so a row that
// could be missing either value would resolve differently from Controle A's
// value at the same scope. Same nullability = identical resolution behavior
// for all three parameters.
//
// Backfill of pre-existing rows: this is still a pre-production schema (same
// framing as MigrateClassGroupToSubject/AddClassGroupSubjects — no real
// tenant data yet), and NOT NULL needs some value for rows created before
// Controle B existed. `min_accumulated_frequency_percentage` is seeded from
// `min_attendance_percentage` because it is the only percentage those rows
// actually contain, and `accumulated_frequency_period` is seeded with
// `bimester` because it has no sibling column to derive from at all. Both are
// one-off dev-data seeds, NOT semantic derivations: there is no runtime
// inheritance between any of these parameters anywhere, and an administrator
// is expected to review both values per scope on the configuration screen.
export class AddAccumulatedFrequencyConfigColumns1755863000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE attendance_config ADD COLUMN min_accumulated_frequency_percentage numeric(5,2)',
    );

    await queryRunner.query(`
      UPDATE attendance_config
      SET min_accumulated_frequency_percentage = min_attendance_percentage
      WHERE min_accumulated_frequency_percentage IS NULL
    `);

    await queryRunner.query(
      'ALTER TABLE attendance_config ALTER COLUMN min_accumulated_frequency_percentage SET NOT NULL',
    );

    await queryRunner.query('ALTER TABLE attendance_config ADD COLUMN accumulated_frequency_period varchar(20)');

    await queryRunner.query(`
      UPDATE attendance_config
      SET accumulated_frequency_period = 'bimester'
      WHERE accumulated_frequency_period IS NULL
    `);

    await queryRunner.query(
      'ALTER TABLE attendance_config ALTER COLUMN accumulated_frequency_period SET NOT NULL',
    );

    await queryRunner.query(`
      ALTER TABLE attendance_config
      ADD CONSTRAINT attendance_config_accumulated_frequency_period_check
      CHECK (accumulated_frequency_period IN ('bimester', 'trimester', 'semester'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE attendance_config DROP CONSTRAINT IF EXISTS attendance_config_accumulated_frequency_period_check',
    );
    await queryRunner.query('ALTER TABLE attendance_config DROP COLUMN IF EXISTS accumulated_frequency_period');
    await queryRunner.query(
      'ALTER TABLE attendance_config DROP COLUMN IF EXISTS min_accumulated_frequency_percentage',
    );
  }
}
