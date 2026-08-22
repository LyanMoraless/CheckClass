import { MigrationInterface, QueryRunner } from 'typeorm';

// New table, approved 2026-08-21: maps a device-local facial match reference
// (see architecture-overview.md's FACIAL_CHECKIN privacy decision) to a
// person, since "local match reference" is scoped per-device, not a
// platform-wide identifier. Also adds the identification_checkin uniqueness
// that makes the Identification worker idempotent against pg-boss's
// at-least-once job delivery — one raw event produces at most one checkin
// (Stage 4's deduplication is a separate concern, applied after this).
export class AddPersonFacialReference1755752000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE person_facial_reference (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        device_id uuid NOT NULL REFERENCES device(id),
        local_reference varchar(255) NOT NULL,
        person_id uuid NOT NULL REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (device_id, local_reference)
      )
    `);
    await queryRunner.query('ALTER TABLE person_facial_reference ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE person_facial_reference FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON person_facial_reference
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON person_facial_reference TO ${appDbUsername}`);

    await queryRunner.query(`
      ALTER TABLE identification_checkin
      ADD CONSTRAINT identification_checkin_raw_event_unique UNIQUE (raw_identification_event_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE identification_checkin DROP CONSTRAINT IF EXISTS identification_checkin_raw_event_unique',
    );
    await queryRunner.query('DROP TABLE IF EXISTS person_facial_reference CASCADE');
  }
}
