import { MigrationInterface, QueryRunner } from 'typeorm';

// room-presence — Fluxo de Chamada Redesenhado (RULE-PRES-04/05/06/07/08,
// business-rules/references/attendance-presence-flow-rules.md), schema
// approved by the architecture in
// project-knowledge/references/architecture-overview.md ("Decisão de
// arquitetura — Fluxo de Chamada Redesenhado") and
// .doc/checkclass-arquitetura-chamada.html ("Onde Fica Cada Lógica —
// 'Em sala por aula'"). Structural precedent: device_binding (Frente 12) —
// a dedicated read primitive that owns its own state and is read by the
// Motor de Regras, never the reverse, and never written to by
// identification_checkin's own pipeline. This migration is schema-only —
// RoomPresenceService (isPresentForSession/getSessionProjectedInterval, the
// RULE-PRES-08 exit-precedence chain) is Backend Agent's next step.
//
// ---------------------------------------------------------------------
// What this table stores, and what it deliberately does NOT store
// ---------------------------------------------------------------------
// One row per physical tag swipe (RULE-PRES-04 entry / RULE-PRES-07 exit)
// already resolved to a specific class_session — i.e. exactly the two data
// points room-presence is described as owning ("dado próprio" in
// RULE-PRES-08's precedence order, priority 1). It does NOT store the
// precedence order's priority-2 signals (afastamento prolongado detectado
// by location-verification, or explicit app logout) — those are described
// in the architecture as "leitura, mão única" (a one-way read room-presence
// performs against raw_location_signal/the app's own logout state when it
// computes getSessionProjectedInterval), not a second write path into this
// table. Persisting a second copy of that signal here would create two
// sources of truth for the same event; reading it live keeps room-presence
// a pure consumer of location-verification's output, matching the
// mão-única coupling direction already fixed by the architecture.
//
// class_session_id is NOT NULL (unlike identification_checkin's own
// nullable column): a device swipe IdentificationService could not resolve
// to any class_session (person outside any scheduled window) has no
// "em sala" meaning for room-presence to track at all — RULE-PRES-04/05/06
// are entirely session-scoped — so the write path simply never produces a
// room_presence_event row for it, rather than persisting a meaningless
// NULL-session row.
//
// room_id is deliberately NOT a column here. IdentificationService.
// resolveClassSession already requires COALESCE(class_session.room_id,
// class_group.room_id) to equal the reading device's own room_id before a
// class_session_id is resolved at all (RULE-PRES-04's "leitor da própria
// sala" is enforced upstream, once, at that resolution step) — a
// class_session's effective room is a 1:1 derived fact of the session
// already, so repeating it here would be speculative denormalization with
// no read pattern to justify it, the same restraint the Solution Architect
// already applied to `room` (no speculative lat/long) in this same
// architecture decision.
//
// ---------------------------------------------------------------------
// Idempotency / dedup — reused from the pipeline, not reinvented
// ---------------------------------------------------------------------
// "Pós-dedup" (architecture doc, Bloco 2/3) cashes out concretely to:
// identification_checkin rows with is_duplicate = false — the exact same
// filter PresenceIntervalService.rebuildForPerson already applies today for
// ROOM_ENTRY/ROOM_EXIT. identification_checkin_id is NOT NULL and UNIQUE:
// each post-dedup checkin produces at most one room_presence_event row, so
// the consuming write (Backend's job, not this migration) is a plain
// INSERT ... ON CONFLICT (identification_checkin_id) DO NOTHING — idempotent
// against job/worker retries for free, without room-presence needing its
// own correlation-key/time-window dedup logic (DeduplicationService's job,
// already done once upstream, is not repeated here). The FK also gives
// ON DELETE CASCADE from identification_checkin (see retention note below).
//
// direction is denormalized from identification_checkin's own
// attendance_factor_type (ROOM_ENTRY -> 'entry', ROOM_EXIT -> 'exit')
// instead of requiring a join on every isPresentForSession/
// getSessionProjectedInterval read — same hot-path-avoids-a-join rationale
// already used for location_consent_decision.subject_person_id. Keeping it
// correct is the write path's responsibility (Backend), the same trust
// boundary identification_checkin's own checkin_at/attendance_factor_type_id
// pairing already relies on without a DB-level guarantee.
//
// ---------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------
// identification_checkin_id ... ON DELETE CASCADE: AttendancePurgeService
// (Frente 10, RULE-RET-01) already deletes identification_checkin rows
// older than the closure window (gated by attendance_pending_review, see
// attendance-retention-pending-gate.service.ts). Without CASCADE here, that
// DELETE would start failing with a FK violation the first time a purged
// checkin has a room_presence_event row pointing at it. CASCADE keeps
// room_presence_event's lifecycle bound to its source event's lifecycle
// without requiring any change to AttendancePurgeService for referential
// integrity to hold — it also automatically inherits the same
// pending-review purge gate identification_checkin already has, since it
// only ever disappears as a side effect of that same gated deletion.
// Flagged for Backend/whoever wires room-presence's retention story: adding
// room_presence_event to AttendancePurgeService's explicit DELETE list
// (defense-in-depth, mirroring presence_interval's own explicit deletion
// rather than relying solely on cascade) is a reasonable follow-up, not
// required for correctness today.
export class AddRoomPresenceEvent1755881000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`
      CREATE TABLE room_presence_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        class_session_id uuid NOT NULL REFERENCES class_session(id),
        direction varchar(10) NOT NULL,
        identification_checkin_id uuid NOT NULL REFERENCES identification_checkin(id) ON DELETE CASCADE,
        occurred_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT room_presence_event_direction_check CHECK (direction IN ('entry', 'exit')),
        CONSTRAINT room_presence_event_identification_checkin_unique UNIQUE (identification_checkin_id)
      )
    `);

    // Serves both known read patterns: RoomPresenceService.isPresentForSession/
    // getSessionProjectedInterval (person_id + class_session_id always bound
    // together) and classroom-headcount-reconciliation's per-session "latest
    // event per person, right now" scan (class_session_id bound, person_id
    // as the grouping key) — class_session_id leads so the latter scan
    // doesn't need a second, near-duplicate index.
    await queryRunner.query(`
      CREATE INDEX room_presence_event_session_person_idx
      ON room_presence_event (tenant_id, class_session_id, person_id, occurred_at)
    `);

    await queryRunner.query('ALTER TABLE room_presence_event ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE room_presence_event FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON room_presence_event
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    // Append-only (every column is set once, at INSERT, exactly like
    // identification_checkin's own shape minus the dedup columns it has no
    // need for here) — a swipe is never edited or physically removed by the
    // application; it only ever disappears via the retention CASCADE above.
    // InitSchema's `ALTER DEFAULT PRIVILEGES ... GRANT SELECT, INSERT,
    // UPDATE, DELETE ON TABLES` already applies to every table created by
    // later migrations, including this one (see FixLegalGuardianGrants,
    // which had to correct exactly this for legal_guardian) — REVOKE is
    // therefore required here, not optional, for "no UPDATE/DELETE" to be
    // real rather than cosmetic.
    await queryRunner.query(`GRANT SELECT, INSERT ON room_presence_event TO ${appDbUsername}`);
    await queryRunner.query(`REVOKE UPDATE, DELETE ON room_presence_event FROM ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS room_presence_event CASCADE');
  }
}
