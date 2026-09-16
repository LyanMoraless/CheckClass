import { MigrationInterface, QueryRunner } from 'typeorm';

// Widens guardian_link_followup's closed reason vocabulary for the new
// legal_guardian CRUD (see "Decisão de arquitetura — CRUD de
// legal_guardian", architecture-overview.md): revoking the legal guardian
// who authored a student's most recent granted location consent
// invalidates that consent retroactively, and revoking a minor's last
// remaining active guardian opens a followup item on its own — both reuse
// this same table (GuardianLinkFollowupReason), consistent with the
// original migration's stated design intent of adding future reasons here
// rather than a table per reason.
export class WidenGuardianLinkFollowupReasonVocabulary1755880000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE guardian_link_followup
      DROP CONSTRAINT guardian_link_followup_reason_check
    `);
    await queryRunner.query(`
      ALTER TABLE guardian_link_followup
      ADD CONSTRAINT guardian_link_followup_reason_check
      CHECK (reason IN (
        'retroactive_minority_location_consent_suspended',
        'legal_guardian_revoked_location_consent_invalidated',
        'no_active_legal_guardian_remaining'
      ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE guardian_link_followup
      DROP CONSTRAINT guardian_link_followup_reason_check
    `);
    await queryRunner.query(`
      ALTER TABLE guardian_link_followup
      ADD CONSTRAINT guardian_link_followup_reason_check
      CHECK (reason IN ('retroactive_minority_location_consent_suspended'))
    `);
  }
}
