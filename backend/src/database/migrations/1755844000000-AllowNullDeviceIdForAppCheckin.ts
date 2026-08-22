import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-ATT-06's confirmed note (2026-08-22): app check-in submits through a
// person-JWT-authenticated path (AppCheckinService), never through the
// device-authenticated ingestion contract — there is no device_id to record
// for that raw_identification_event row. device_id NULL now means
// "app-originated" by construction, the same nullable-means-something
// convention attendance_factor_type.tenant_id already uses for "standard,
// not tenant-specific" (RULE-ATT-13). Device-originated rows are completely
// unaffected: IngestionService always supplies a real device_id from
// DeviceAuthGuard, so this column only ever ends up NULL for the new path.
//
// Backend Agent note: additive/backward-compatible (DROP NOT NULL never
// invalidates existing rows), needed for AppCheckinService.submit() to
// persist at all. Flagged to the Orchestrator/Database Agent for review —
// see this migration file's sibling, SeedAppCheckinFactorType, for the same
// note on why a Backend Agent wrote it directly this time.
export class AllowNullDeviceIdForAppCheckin1755844000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE raw_identification_event ALTER COLUMN device_id DROP NOT NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only safe to revert if no app-originated (device_id IS NULL) rows have
    // been written yet — this intentionally does NOT delete/backfill data to
    // force the column back to NOT NULL; a real rollback plan for existing
    // app-checkin rows is a Database Agent decision, not this migration's.
    await queryRunner.query('ALTER TABLE raw_identification_event ALTER COLUMN device_id SET NOT NULL');
  }
}
