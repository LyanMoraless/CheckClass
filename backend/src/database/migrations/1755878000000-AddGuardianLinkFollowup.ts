import { MigrationInterface, QueryRunner } from 'typeorm';

// Closes the production-readiness gap left open by
// AddLegalGuardianAndLocationConsentDecision: RetroactiveMinorConsentGuardService
// only logged (logger.warn) when it automatically suspended a location
// consent for retroactive minority — Security marked this as blocking
// before RULE-PRES-14 operates with automatic suspension in production,
// requiring "a real, traceable trigger of the legal-guardian flow" (see
// legal-guardian-consent-rules.md, RULE-GRD-07/RULE-PRES-14).
//
// Schema from "Proposta do Solution Architect para o gatilho real do
// fluxo de responsável legal (guardian_link_followup)",
// architecture-overview.md — 3 rounds of Solution Architect, 2 rounds of
// Security review, 1 Business Analyst confirmation (no existing automatic
// re-open of the person screen for this case) and the user's final
// decision on visibility ("varredura periódica como rede de segurança",
// 2026-09-15). This migration is schema-only: the service call that opens
// an item on suspension, and the resolve()/listAllOpen() read paths, are
// Backend Agent's next step.
export class AddGuardianLinkFollowup1755878000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`
      CREATE TABLE guardian_link_followup (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        -- The minor whose location consent was suspended.
        subject_person_id uuid NOT NULL REFERENCES person(id),
        -- Closed vocabulary, one value today. Designed for RULE-FACE-09 to
        -- reuse this same table with a second value later, instead of a
        -- table per consent type (Solution Architect, architecture-overview.md).
        reason varchar(100) NOT NULL,
        -- Explicit, typed FK to the location_consent_decision row
        -- (decision = 'revoked') that caused this item, instead of a
        -- generic untyped reference — referential integrity guaranteed by
        -- the database rather than application discipline (Security agreed
        -- after initially suggesting a generic column; see
        -- architecture-overview.md).
        related_location_consent_decision_id uuid REFERENCES location_consent_decision(id),
        -- Secretaria staff member whose in-person confirmation of
        -- date_of_birth triggered the automatic suspension.
        triggered_by_person_id uuid NOT NULL REFERENCES person(id),
        -- open | resolved. No TTL: an item never expires on its own.
        status varchar(20) NOT NULL DEFAULT 'open',
        resolved_by_person_id uuid REFERENCES person(id),
        resolved_at timestamptz,
        resolution_note text,
        opened_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT guardian_link_followup_reason_check
          CHECK (reason IN ('retroactive_minority_location_consent_suspended')),
        CONSTRAINT guardian_link_followup_status_check
          CHECK (status IN ('open', 'resolved')),
        -- Same mutual-exclusivity pattern as
        -- location_consent_decision_decided_by_exclusive_check: the 3
        -- resolution columns are all NULL while open, and all required
        -- once resolved — resolution is atomic, never partial.
        CONSTRAINT guardian_link_followup_resolution_exclusive_check CHECK (
          (status = 'open' AND resolved_by_person_id IS NULL AND resolved_at IS NULL AND resolution_note IS NULL)
          OR (status = 'resolved' AND resolved_by_person_id IS NOT NULL AND resolved_at IS NOT NULL AND resolution_note IS NOT NULL)
        )
      )
    `);

    // Idempotency requirement: at most one open item per
    // (tenant_id, subject_person_id, reason) at a time.
    await queryRunner.query(`
      CREATE UNIQUE INDEX guardian_link_followup_open_idempotency_idx
      ON guardian_link_followup (tenant_id, subject_person_id, reason)
      WHERE status = 'open'
    `);

    // GET /v1/guardian-link-followups listAllOpen(): all open items for a
    // tenant, ordered by opened_at ascending. Kept as a separate partial
    // index from the idempotency one above (different leading/sort
    // columns; the idempotency index is not usable for this ORDER BY).
    await queryRunner.query(`
      CREATE INDEX guardian_link_followup_open_opened_at_idx
      ON guardian_link_followup (tenant_id, opened_at ASC)
      WHERE status = 'open'
    `);

    await queryRunner.query('ALTER TABLE guardian_link_followup ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE guardian_link_followup FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON guardian_link_followup
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    await queryRunner.query(`GRANT SELECT, INSERT ON guardian_link_followup TO ${appDbUsername}`);
    // Column-level UPDATE: only the 4 resolution columns are ever written
    // after INSERT. Opening columns (subject_person_id, reason,
    // related_location_consent_decision_id, triggered_by_person_id,
    // opened_at) are immutable — enforced by the database, not just
    // application discipline. No DELETE is granted to any application role.
    await queryRunner.query(`
      GRANT UPDATE (status, resolved_at, resolved_by_person_id, resolution_note)
      ON guardian_link_followup TO ${appDbUsername}
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS guardian_link_followup CASCADE');
  }
}
