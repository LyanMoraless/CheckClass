import { MigrationInterface, QueryRunner } from 'typeorm';

// Corrects the grants applied to legal_guardian by
// AddLegalGuardianAndLocationConsentDecision: that migration granted
// SELECT, INSERT, UPDATE, DELETE (full, column-unrestricted) to the
// application role, which was never actually needed — legal_guardian is
// revoked (soft state change), never physically deleted (RULE-GRD-06), and
// only 4 columns are ever written after INSERT (LegalGuardianService.update/
// revoke, see "Decisão de arquitetura — CRUD de legal_guardian",
// architecture-overview.md). Same defense-in-depth pattern already applied
// to guardian_link_followup (AddGuardianLinkFollowup): opening/identity
// columns are immutable at the database level, not just by application
// discipline.
export class FixLegalGuardianGrants1755879000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`REVOKE DELETE ON legal_guardian FROM ${appDbUsername}`);
    await queryRunner.query(`REVOKE UPDATE ON legal_guardian FROM ${appDbUsername}`);

    // Column-level UPDATE: only the 4 columns LegalGuardianService actually
    // writes after INSERT (fullName/documentNumber via update(), status via
    // revoke(), updatedAt as its side effect). tenant_id, student_person_id,
    // registered_by_person_id, signature_captured_at, created_at and id are
    // immutable at the database level — enforced here, not just by
    // application discipline.
    await queryRunner.query(`
      GRANT UPDATE (full_name, document_number, status, updated_at)
      ON legal_guardian TO ${appDbUsername}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`REVOKE UPDATE (full_name, document_number, status, updated_at) ON legal_guardian FROM ${appDbUsername}`);
    await queryRunner.query(`GRANT UPDATE ON legal_guardian TO ${appDbUsername}`);
    await queryRunner.query(`GRANT DELETE ON legal_guardian TO ${appDbUsername}`);
  }
}
