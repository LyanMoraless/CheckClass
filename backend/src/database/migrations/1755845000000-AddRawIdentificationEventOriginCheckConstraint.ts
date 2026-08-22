import { MigrationInterface, QueryRunner } from 'typeorm';

// Database Agent review finding (RULE-RET-04 — technical-administrator raw-
// event audit access): AllowNullDeviceIdForAppCheckin made device_id
// nullable so app-originated rows have "no device" to record, and
// event_type = 'APP_CHECKIN' already tells an auditor the origin (it is a
// mandatory, always-populated column — never buried in raw_payload — the
// same way every other event_type value already identifies its device-based
// origin). What was still missing was a DB-level guarantee that these two
// columns can never drift apart: without this constraint, nothing stops a
// future bug from inserting a device-originated row with a forgotten
// device_id (silently indistinguishable, on device_id alone, from a
// legitimate app check-in), or an APP_CHECKIN row that a future code path
// ends up stamping with a bogus device_id. This CHECK makes "device_id IS
// NULL exclusively for APP_CHECKIN, and APP_CHECKIN never has a device_id"
// an invariant the database itself enforces, closing that gap without
// introducing a redundant origin-marker column (event_type already plays
// that role for every event type, not just this one).
//
// Safe against existing data: every row inserted before this feature always
// had a real device_id and a non-APP_CHECKIN event_type (APP_CHECKIN did
// not exist until SeedAppCheckinFactorType/AllowNullDeviceIdForAppCheckin),
// so no pre-existing row can violate this constraint.
export class AddRawIdentificationEventOriginCheckConstraint1755845000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE raw_identification_event
      ADD CONSTRAINT raw_identification_event_origin_check
      CHECK (
        (device_id IS NOT NULL AND event_type <> 'APP_CHECKIN')
        OR (device_id IS NULL AND event_type = 'APP_CHECKIN')
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE raw_identification_event DROP CONSTRAINT IF EXISTS raw_identification_event_origin_check',
    );
  }
}
