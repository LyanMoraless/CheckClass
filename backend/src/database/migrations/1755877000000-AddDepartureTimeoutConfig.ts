import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-PRES-09's second configurable parameter (distância already reuses
// institutional_location_config.radius_meters; this is the separate
// duration parameter — 15 minutes reference value), from the schema
// approved by the user 2026-09-15 ("Desenho de schema — Localização,
// timeout de afastamento e responsável legal", item 6,
// architecture-overview.md). Deliberately NOT on
// institutional_location_config (would blur that table's pure "geographic
// identity" purpose) — mirrors tolerance_minutes' existing shape on
// attendance_config: same institution->course->class_group scope
// resolution, no CHECK constraint (same absence as tolerance_minutes).
//
// Snapshotted onto class_session (departure_timeout_minutes_snapshot),
// same mechanism as the three fields class_session already snapshots from
// attendance_config (min_attendance_percentage/tolerance_minutes/
// post_tolerance_behavior) — necessary because the afastamento monitor
// reads this value LIVE during an in-progress session; without a snapshot,
// a mid-class config change would retroactively change the threshold for a
// student already being monitored.
//
// Backfill of pre-existing rows: same "still pre-production schema, no real
// tenant data yet" framing already used by AddAccumulatedFrequencyConfigColumns
// — both new NOT NULL columns are seeded with 15 (the user's own reference
// value for RULE-PRES-09), a one-off dev-data seed, not a semantic
// derivation from any other column (there is no sibling column to derive a
// duration from, unlike Controle A's percentage columns).
export class AddDepartureTimeoutConfig1755877000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE attendance_config ADD COLUMN departure_timeout_minutes int');
    await queryRunner.query(`
      UPDATE attendance_config
      SET departure_timeout_minutes = 15
      WHERE departure_timeout_minutes IS NULL
    `);
    await queryRunner.query(
      'ALTER TABLE attendance_config ALTER COLUMN departure_timeout_minutes SET NOT NULL',
    );

    await queryRunner.query('ALTER TABLE class_session ADD COLUMN departure_timeout_minutes_snapshot int');
    await queryRunner.query(`
      UPDATE class_session
      SET departure_timeout_minutes_snapshot = 15
      WHERE departure_timeout_minutes_snapshot IS NULL
    `);
    await queryRunner.query(
      'ALTER TABLE class_session ALTER COLUMN departure_timeout_minutes_snapshot SET NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE class_session DROP COLUMN IF EXISTS departure_timeout_minutes_snapshot');
    await queryRunner.query('ALTER TABLE attendance_config DROP COLUMN IF EXISTS departure_timeout_minutes');
  }
}
