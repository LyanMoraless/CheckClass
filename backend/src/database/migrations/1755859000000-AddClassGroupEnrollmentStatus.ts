import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-11: student enrollment situation becomes a fixed 4-value enum
// (Ativo, Trancado, Formado, Evadido), with free transitions between all
// four (confirmed — no state machine needed at the DB or app level). English
// naming favors the actual academic-English terms over a literal word-for-
// word translation (per coding-identity.md): active | on_leave | graduated |
// withdrawn. Defaults to 'active' so every existing enrollment row (all
// created before this concept existed, and therefore implicitly active)
// keeps its correct meaning without a manual backfill.
export class AddClassGroupEnrollmentStatus1755859000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE class_group_enrollment ADD COLUMN enrollment_status varchar(20) NOT NULL DEFAULT 'active'",
    );
    await queryRunner.query(`
      ALTER TABLE class_group_enrollment
      ADD CONSTRAINT class_group_enrollment_status_check
      CHECK (enrollment_status IN ('active', 'on_leave', 'graduated', 'withdrawn'))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE class_group_enrollment DROP CONSTRAINT IF EXISTS class_group_enrollment_status_check',
    );
    await queryRunner.query('ALTER TABLE class_group_enrollment DROP COLUMN IF EXISTS enrollment_status');
  }
}
