import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-PRES-01 (login) / RULE-PRES-09 (afastamento durante a aula),
// business-rules/references/attendance-presence-flow-rules.md, from the
// schema approved by the user 2026-09-15 ("Desenho de schema — Localização,
// timeout de afastamento e responsável legal", item 2,
// architecture-overview.md). One row per GPS reading. Typed columns, not
// jsonb (technology decision already made, rejecting jsonb for this table).
//
// signal_type: closed vocabulary of two values, varchar + CHECK — same
// pattern used everywhere else in this schema for a closed vocabulary
// (post_tolerance_behavior, accumulated_frequency_period, device_binding.
// status), never a native ENUM.
//
// class_session_id: nullable, same shape as identification_checkin — a
// login_checkin reading captured outside any resolvable class window has no
// session to attach to (divergence accepted by the user 2026-09-15; no
// alternate retention ceiling created for that corner case).
//
// raw_identification_event_id: nullable, correlates a login_checkin reading
// to the identification event it gated (Database Agent addition, approved
// by the user 2026-09-15) — never populated for class_monitoring readings,
// which have no identification event at all (the person is already
// authenticated via JWT for the whole class session).
//
// captured_at: server clock only (RULE-PRES-02) — deliberately no
// device-supplied timestamp column, same posture already enforced for
// raw_identification_event's ingestion contract.
//
// idempotency_key: tenant-scoped UNIQUE from creation — unlike
// raw_identification_event, which needed a later correction
// (ScopeIdempotencyKeyToTenant) for this.
//
// person_id: nullable, closed by CHECK to signal_type (schema gap flagged
// above — resolved by the user 2026-09-15, "Desenho de schema —
// Localização, timeout de afastamento e responsável legal", gap 1). NULL
// for login_checkin: the person stays reachable only via
// raw_identification_event_id -> identification_checkin.person_id, so this
// table never becomes a second source of truth for who a login_checkin
// reading belongs to. NOT NULL for class_monitoring: there is no
// raw_identification_event on that path at all (the student is already
// authenticated via JWT for the whole class session), so person_id is the
// only possible attribution.
export class AddRawLocationSignal1755874000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`
      CREATE TABLE raw_location_signal (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        signal_type varchar(20) NOT NULL,
        class_session_id uuid REFERENCES class_session(id),
        raw_identification_event_id uuid REFERENCES raw_identification_event(id),
        person_id uuid REFERENCES person(id),
        latitude numeric(9,6) NOT NULL,
        longitude numeric(9,6) NOT NULL,
        accuracy_meters numeric(7,2) NOT NULL,
        is_mocked boolean NOT NULL DEFAULT false,
        captured_at timestamptz NOT NULL DEFAULT now(),
        idempotency_key varchar(255) NOT NULL,
        CONSTRAINT raw_location_signal_signal_type_check
          CHECK (signal_type IN ('login_checkin', 'class_monitoring')),
        CONSTRAINT raw_location_signal_tenant_idempotency_key_unique UNIQUE (tenant_id, idempotency_key),
        -- Ties person_id's nullability to signal_type (see comment above the
        -- class declaration): exactly one attribution path per signal_type,
        -- never both, never neither.
        CONSTRAINT raw_location_signal_person_id_signal_type_check CHECK (
          (signal_type = 'login_checkin' AND person_id IS NULL)
          OR (signal_type = 'class_monitoring' AND person_id IS NOT NULL)
        )
      )
    `);

    // Per-session purge sweep (RULE-RET-04-style expunge, same EXISTS gate
    // against attendance_pending_review.resolved_at IS NULL already used by
    // Frente 10) needs a fast "all signals for this session" scan. Kept
    // distinct from the class_monitoring index below — this one serves
    // retention/expurgo (all signal_types, no person_id), the other serves
    // per-student reads for the departure monitor.
    await queryRunner.query(`
      CREATE INDEX raw_location_signal_class_session_id_idx
      ON raw_location_signal (tenant_id, class_session_id)
      WHERE class_session_id IS NOT NULL
    `);

    // RULE-PRES-01's login-decision path looks up the location reading that
    // gated a specific identification event.
    await queryRunner.query(`
      CREATE INDEX raw_location_signal_raw_identification_event_id_idx
      ON raw_location_signal (raw_identification_event_id)
      WHERE raw_identification_event_id IS NOT NULL
    `);

    // RULE-PRES-09's future departure-timeout monitor reads: "this student's
    // readings, in this class session, chronologically" — partial, since
    // only class_monitoring rows are ever queried this way (login_checkin
    // has no person_id to filter by).
    await queryRunner.query(`
      CREATE INDEX raw_location_signal_class_monitoring_person_idx
      ON raw_location_signal (tenant_id, class_session_id, person_id, captured_at DESC)
      WHERE signal_type = 'class_monitoring'
    `);

    await queryRunner.query('ALTER TABLE raw_location_signal ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE raw_location_signal FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON raw_location_signal
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON raw_location_signal TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS raw_location_signal CASCADE');
  }
}
