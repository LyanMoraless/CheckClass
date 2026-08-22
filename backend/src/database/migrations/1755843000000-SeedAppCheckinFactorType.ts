import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-ATT-06's confirmed note (2026-08-22): "aplicativo" is a standard
// platform check-in mechanism, same bucket as TAG_CHECKIN/FACIAL_CHECKIN
// seeded by SeedStandardAttendanceFactorTypes — tenant_id NULL so every
// tenant sees it (RULE-ATT-13's exception, already modeled by that
// migration's RLS policy for this table). Kept as its own migration rather
// than amending SeedStandardAttendanceFactorTypes because the app check-in
// submission path is a distinct, later capability (app-checkin module),
// not part of the original device-ingestion factor set.
//
// Backend Agent note: this is an additive, reversible, standard-shape seed
// insert (mirrors SeedStandardAttendanceFactorTypes exactly) — written here
// because withholding it would leave the app check-in feature entirely
// non-functional at runtime (AppCheckinService.submit() depends on this row
// existing). Flagged to the Orchestrator/Database Agent for review, since
// this codebase's convention elsewhere routes schema/seed changes through
// a dedicated Database Agent commit rather than a Backend Agent one.
//
// `this.code` below is intentionally its own literal, not an import of
// src/modules/attendance-factor-codes.ts's APP_CHECKIN_FACTOR_CODE — a
// migration is a one-time, standalone script and must not depend on
// application source (which can change/be refactored independently of
// already-applied migrations). It MUST match that shared constant's value
// exactly; keep the two in sync by review, not by import.
export class SeedAppCheckinFactorType1755843000000 implements MigrationInterface {
  private readonly code = 'APP_CHECKIN';
  private readonly factorName = 'Mobile app check-in';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO attendance_factor_type (tenant_id, code, name, is_custom) VALUES (NULL, $1, $2, false)`,
      [this.code, this.factorName],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM attendance_factor_type WHERE tenant_id IS NULL AND code = $1`, [this.code]);
  }
}
