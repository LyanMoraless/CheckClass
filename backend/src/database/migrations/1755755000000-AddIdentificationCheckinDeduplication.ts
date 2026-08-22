import { MigrationInterface, QueryRunner } from 'typeorm';

// Deduplication Service's persistence surface (RULE-ATT-10 / RULE-RET-03):
// a duplicate checkin is kept (audit trail, RULE-RET-04's technical-admin
// access to raw/derived device data) but flagged, pointing at the canonical
// one it duplicates. The Motor de Regras (later stage) only ever reads
// is_duplicate = false rows.
export class AddIdentificationCheckinDeduplication1755755000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE identification_checkin
        ADD COLUMN is_duplicate boolean NOT NULL DEFAULT false,
        ADD COLUMN duplicate_of_checkin_id uuid REFERENCES identification_checkin(id)
    `);
    // Speeds up the Deduplication Service's correlation-key lookup
    // (tenant_id + person_id + class_session_id + attendance_factor_type_id,
    // RULE-RET-03) done on every new checkin.
    await queryRunner.query(`
      CREATE INDEX identification_checkin_dedup_key_idx
      ON identification_checkin (tenant_id, person_id, attendance_factor_type_id, class_session_id, checkin_at)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS identification_checkin_dedup_key_idx');
    await queryRunner.query(`
      ALTER TABLE identification_checkin
        DROP COLUMN IF EXISTS duplicate_of_checkin_id,
        DROP COLUMN IF EXISTS is_duplicate
    `);
  }
}
