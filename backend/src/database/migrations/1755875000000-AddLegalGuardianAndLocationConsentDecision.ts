import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-GRD-01..07 (business-rules/references/legal-guardian-consent-rules.md)
// and RULE-PRES-14 (business-rules/references/attendance-presence-flow-rules.md),
// from the schema approved by the user 2026-09-15 ("Desenho de schema —
// Localização, timeout de afastamento e responsável legal", items 3 and 4,
// architecture-overview.md). Grouped in one migration for coherence:
// location_consent_decision's decided_by_legal_guardian_id FK depends on
// legal_guardian existing first.
export class AddLegalGuardianAndLocationConsentDecision1755875000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    // ---------------------------------------------------------------------
    // 1. legal_guardian — declared record of a student<->legal guardian
    // link (RULE-GRD-02), own table, no relation to authentication/
    // credential (Solution Architect: reusing `person` without
    // `person_credential` risked incidental coupling with chamada/câmera/
    // tag/liderança, which already filter by actor_type).
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE legal_guardian (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        student_person_id uuid NOT NULL REFERENCES person(id),
        full_name varchar(255) NOT NULL,
        document_number varchar(50) NOT NULL,
        -- Database Agent interpretation of "referência de assinatura"
        -- (confirmed by the user 2026-09-15): a timestamp of the presencial
        -- capture, same server-clock-only convention as captured_at
        -- elsewhere in this batch — no image/file of the signature itself
        -- is stored (RULE-GRD-05: no documentary proof is required or kept).
        signature_captured_at timestamptz NOT NULL DEFAULT now(),
        -- Secretaria staff who registered the link (audit convention already
        -- used by intrusion_incident/attendance_pending_review), approved by
        -- the user 2026-09-15 though not literally required by RULE-GRD text.
        registered_by_person_id uuid NOT NULL REFERENCES person(id),
        -- active | revoked (RULE-GRD-06: editable/revocable by the
        -- Secretaria at any time, no approval flow) — status column instead
        -- of physical deletion, same pattern as
        -- intrusion_incident/attendance_frequency_warning.
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT legal_guardian_status_check CHECK (status IN ('active', 'revoked'))
      )
    `);

    // RULE-GRD-03 hot path: "does this student have at least one active
    // guardian, and who are they" — any one of them consenting is enough.
    await queryRunner.query(`
      CREATE INDEX legal_guardian_student_person_id_idx
      ON legal_guardian (tenant_id, student_person_id)
      WHERE status = 'active'
    `);

    await queryRunner.query('ALTER TABLE legal_guardian ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE legal_guardian FORCE ROW LEVEL SECURITY');
    // RLS simple por tenant — RULE-GRD-06 does not become a distinct RLS
    // policy because there is no fixed "Secretaria" role at the database
    // layer (permission_group is defined per tenant); who may edit/revoke is
    // entirely an application-layer (Permission-guard) restriction, to be
    // built when Backend implements this — accepted by the user 2026-09-15.
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON legal_guardian
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON legal_guardian TO ${appDbUsername}`);

    // ---------------------------------------------------------------------
    // 2. location_consent_decision — append-only log (RULE-PRES-14); status
    // efetivo = linha mais recente por subject_person_id. Never UPDATE/
    // DELETE.
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE location_consent_decision (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        -- Titular do consentimento (added, approved by the user 2026-09-15):
        -- equals decided_by_person_id when the student decides for
        -- themself, equals legal_guardian.student_person_id when a guardian
        -- decides — denormalized so RULE-PRES-01's hot login path never
        -- needs to join through legal_guardian to know whose consent this is.
        subject_person_id uuid NOT NULL REFERENCES person(id),
        -- Closed vocabulary for who decided (schema gap 2, resolved by the
        -- user 2026-09-15): 'system' covers automatic suspension with no
        -- human decider at all — e.g. RULE-GRD-07's soft block firing the
        -- moment date_of_birth is still missing. Drives which of the two
        -- FKs below (if any) must be set; see the exclusivity CHECK.
        decided_by_type varchar(20) NOT NULL,
        -- Mutually exclusive pair (Solution Architect, 2026-09-15) instead
        -- of a loose polymorphic column, so referential integrity is real —
        -- same component RULE-FACE-09 will reuse when implemented. Both
        -- NULL when decided_by_type = 'system' (no human decider).
        decided_by_person_id uuid REFERENCES person(id),
        decided_by_legal_guardian_id uuid REFERENCES legal_guardian(id),
        -- granted | refused | revoked (RULE-PRES-14's own vocabulary).
        decision varchar(20) NOT NULL,
        -- Distinct from decided_by_*: which human action triggered an
        -- automatic ('system') suspension, e.g. the Secretaria staff member
        -- who confirmed date_of_birth in person (RULE-GRD-07). This is "who
        -- caused the trigger condition", not "who decided" — the system
        -- decided; only ever set when decided_by_type = 'system', and even
        -- then may be unknown/NULL.
        system_action_triggered_by_person_id uuid REFERENCES person(id),
        -- Evidence of which version of the consent text was shown (Database
        -- Agent addition, not literal RULE-PRES-14 text, pending
        -- confirmation per architecture-overview.md).
        consent_version varchar(50) NOT NULL,
        captured_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT location_consent_decision_decision_check
          CHECK (decision IN ('granted', 'refused', 'revoked')),
        CONSTRAINT location_consent_decision_decided_by_type_check
          CHECK (decided_by_type IN ('person', 'legal_guardian', 'system')),
        CONSTRAINT location_consent_decision_decided_by_exclusive_check CHECK (
          (decided_by_type = 'person' AND decided_by_person_id IS NOT NULL AND decided_by_legal_guardian_id IS NULL)
          OR (decided_by_type = 'legal_guardian' AND decided_by_person_id IS NULL AND decided_by_legal_guardian_id IS NOT NULL)
          OR (decided_by_type = 'system' AND decided_by_person_id IS NULL AND decided_by_legal_guardian_id IS NULL)
        ),
        CONSTRAINT location_consent_decision_system_action_triggered_by_check CHECK (
          system_action_triggered_by_person_id IS NULL OR decided_by_type = 'system'
        ),
        -- Security requirement (2026-09-15): the system has no LGPD Art. 14
        -- legal basis to grant or refuse consent on a subject's behalf —
        -- only to revoke it (e.g. RULE-GRD-07's soft block). Makes
        -- decided_by_type='system' paired with decision='granted'/'refused'
        -- unrepresentable, rather than relying on application code to never
        -- write it.
        CONSTRAINT location_consent_decision_system_revoked_only_check CHECK (
          decided_by_type <> 'system' OR decision = 'revoked'
        )
      )
    `);

    // RULE-PRES-01's hot login path: "what is the current effective consent
    // for this person" = most recent row by captured_at for that subject.
    await queryRunner.query(`
      CREATE INDEX location_consent_decision_subject_captured_at_idx
      ON location_consent_decision (tenant_id, subject_person_id, captured_at DESC)
    `);

    await queryRunner.query('ALTER TABLE location_consent_decision ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE location_consent_decision FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON location_consent_decision
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    // Append-only: no UPDATE/DELETE grant, same "no DELETE" partial-grant
    // precedent already used for attendance_closure_document. Confirmed
    // (Database Agent, 2026-09-15) this remains sufficient after adding
    // decided_by_type and system_action_triggered_by_person_id: both are
    // set once, at INSERT time, exactly like every other column on this
    // row — an automatic suspension is a new row, never an edit to an
    // existing one. No UPDATE path is needed for them.
    await queryRunner.query(`GRANT SELECT, INSERT ON location_consent_decision TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS location_consent_decision CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS legal_guardian CASCADE');
  }
}
