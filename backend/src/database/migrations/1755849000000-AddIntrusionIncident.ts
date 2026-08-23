import { MigrationInterface, QueryRunner } from 'typeorm';

// Motor de Detecção de Intrusão + Registro/Consulta de Alertas de
// Segurança (Solution Architect decision approved 2026-08-23). Two tables:
//
// 1. intrusion_incident — the incident itself. person_id/wristband_category_id
//    are nullable because RULE-SEC-01's note confirms an incident can
//    correlate either an unauthorized-wristband signal (identity known,
//    from an AREA_READER_SCAN whose category has no valid permission for
//    the area) or an unexplained IR barrier crossing (anonymous by nature —
//    a beam break carries no identity data at all). When identity is known,
//    person_id/wristband_category_id are stored directly (a snapshot of
//    what the Serviço de Identidade por Pulseira resolved at detection
//    time), the same convention identification_checkin already uses
//    (storing resolved person_id rather than a wristband_id FK) — so a
//    later wristband reassignment can never retroactively change what an
//    already-open incident says about who was detected.
//
//    current_area_id is a deliberate denormalization: RULE-SEC-03's camera
//    auto-follow is polled frequently by the frontend, and needs "the
//    incident's current estimated area" on every poll. Recomputing that
//    from the latest location-history row on every request is avoidable
//    work for a value that changes at write time, not read time — this
//    column is written in the same transaction as each new
//    intrusion_incident_location_entry row, never read-derived. This is the
//    one denormalization in this schema, and it exists only because of a
//    concrete, frequent read pattern already approved (polling), not as a
//    reflexive default.
//
//    status/outcome/closure fields implement RULE-SEC-07 (any "Equipe de
//    segurança" member can close; two outcomes; mandatory note) — flat
//    authorization confirmed by that rule (no leadership hierarchy table,
//    unlike RULE-ATT-12's leadership_assignment), so closed_by_person_id is
//    a plain FK to person, with no role/assignment table backing it. Which
//    person IDs are actually eligible ("is a member of Equipe de segurança")
//    is an authorization check the Backend Agent enforces at the service
//    layer against actor_type/permission groups — this schema does not
//    encode that check itself.
//
//    The CHECK constraint below makes RULE-SEC-07's "mandatory note on
//    every closure" a database-enforced invariant (same precedent as
//    AddRawIdentificationEventOriginCheckConstraint): closure fields are
//    either all NULL (open) or all populated together (closed) — an
//    application bug can never leave a closed incident without its
//    mandatory outcome/note/closer.
//
//    The partial unique index enforces the confirmed "index case" behavior
//    (RULE-SEC-01's note, resolved 2026-08-23): at most one OPEN incident
//    per tenant at any time. A new correlated signal while an incident is
//    open must update that same incident (append a location-history row),
//    never open a second one — this index makes that a database-level
//    guarantee, not just an application convention.
//
// 2. intrusion_incident_location_entry — the movement trail RULE-SEC-02
//    requires (a history, not a single current-location field). Each row
//    traces back to the raw_security_event that produced it, so the trail
//    is always auditable to its originating signal.
export class AddIntrusionIncident1755849000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE intrusion_incident (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid REFERENCES person(id),
        wristband_category_id uuid REFERENCES wristband_category(id),
        current_area_id uuid REFERENCES area(id),
        status varchar(20) NOT NULL DEFAULT 'open',
        opened_at timestamptz NOT NULL DEFAULT now(),
        outcome varchar(20),
        resolution_note text,
        closed_by_person_id uuid REFERENCES person(id),
        closed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT intrusion_incident_status_check CHECK (status IN ('open', 'closed')),
        CONSTRAINT intrusion_incident_outcome_check
          CHECK (outcome IS NULL OR outcome IN ('resolved', 'false_positive')),
        CONSTRAINT intrusion_incident_closure_check CHECK (
          (status = 'open' AND closed_at IS NULL AND outcome IS NULL
            AND resolution_note IS NULL AND closed_by_person_id IS NULL)
          OR
          (status = 'closed' AND closed_at IS NOT NULL AND outcome IS NOT NULL
            AND resolution_note IS NOT NULL AND closed_by_person_id IS NOT NULL)
        )
      )
    `);

    // RULE-SEC-01's confirmed "index case" behavior: at most one open
    // incident per tenant at a time.
    await queryRunner.query(`
      CREATE UNIQUE INDEX intrusion_incident_one_open_per_tenant
      ON intrusion_incident (tenant_id) WHERE status = 'open'
    `);

    await queryRunner.query('ALTER TABLE intrusion_incident ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE intrusion_incident FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON intrusion_incident
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    await queryRunner.query(`
      CREATE TABLE intrusion_incident_location_entry (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        intrusion_incident_id uuid NOT NULL REFERENCES intrusion_incident(id),
        raw_security_event_id uuid NOT NULL REFERENCES raw_security_event(id),
        area_id uuid NOT NULL REFERENCES area(id),
        detected_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Ordered trail retrieval for a given incident (Registro/Consulta de
    // Alertas de Segurança read side).
    await queryRunner.query(`
      CREATE INDEX intrusion_incident_location_entry_incident_detected_idx
      ON intrusion_incident_location_entry (intrusion_incident_id, detected_at)
    `);

    await queryRunner.query('ALTER TABLE intrusion_incident_location_entry ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE intrusion_incident_location_entry FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON intrusion_incident_location_entry
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON intrusion_incident TO ${appDbUsername}`);
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON intrusion_incident_location_entry TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS intrusion_incident_location_entry CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS intrusion_incident CASCADE');
  }
}
