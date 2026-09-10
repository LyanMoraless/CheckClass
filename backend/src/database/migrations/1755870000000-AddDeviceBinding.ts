import { MigrationInterface, QueryRunner } from 'typeorm';

// Frente 12 — Vínculo de Dispositivo Institucional. From the architecture
// ("Decisão de arquitetura — Vínculo de Dispositivo Institucional (Frente
// 12)") and technology ("Decisão de tecnologia — ...") decisions approved
// 2026-09-10, and RULE-DEV-01..18
// (business-rules/references/institutional-device-binding-rules.md). Six
// tables, all tenant_id + RLS, same posture as every table added since
// Segurança de Intrusão.
//
// Physical shape decision (left open by the Solution Architect on purpose):
// device_identity is a thin supertype row; institutional_machine and
// personal_device are subtypes sharing its id (class-table-inheritance),
// NOT one wide table with a discriminator. Reasoning: RULE-DEV-04's four
// required field groups (patrimônio/série; sala/bloco/status; especificação
// técnica; curso) exist ONLY for institutional_machine — a single table
// would need ~10 columns nullable exclusively for the BYOD branch, each
// needing a conditional CHECK to still be "required for institutional,
// absent for personal". The supertype also gives device_credential and
// device_binding ONE plain FK target (device_identity_id) instead of both
// needing an "exactly one of institutional_machine_id/personal_device_id
// set" CHECK duplicated in two places. Trade-off accepted: nothing at the
// DB level forces a device_identity row to have exactly one matching
// subtype row — that invariant is upheld by the application always writing
// device_identity + its one subtype row inside a single transaction, same
// precedent already accepted in this codebase for a cross-table invariant
// too fine-grained for a CHECK constraint (see class_group.entity.ts's
// comment on course_id: "enforced by ClassGroupService, not by a DB
// constraint").
//
// institutional_machine.room_id reuses the existing `room` table (the same
// one class_session/class_group already reference) rather than a new free-
// text "sala/bloco" field or the security-facing `area` hierarchy directly.
// RULE-DEV-09 compares "sala da máquina" to "sala da sessão" — an exact
// room match — so pointing at the same `room` FK type both sides already
// use turns that into a plain id equality, no cross-hierarchy translation.
// "Bloco" (RULE-DEV-04 group 2) is not a separate column: `room.area_id`
// already optionally chains into the self-referencing `area` hierarchy
// added for Segurança de Intrusão (AddArea migration), whose top-level rows
// ARE the "bloco" — reusing that solved concept instead of reinventing it.
export class AddDeviceBinding1755870000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    const grant = async (table: string) =>
      queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${appDbUsername}`);
    const enableRls = async (table: string) => {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    };

    // -----------------------------------------------------------------
    // 1. device_identity — supertype anchor row (see header for why).
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE device_identity (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await enableRls('device_identity');
    await grant('device_identity');

    // -----------------------------------------------------------------
    // 2. institutional_machine — RULE-DEV-04's inventory (four required
    // field groups, no exceptions documented). Separate from `device`
    // (RULE-DEV-03) — never touches that table.
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE institutional_machine (
        id uuid PRIMARY KEY REFERENCES device_identity(id) ON DELETE CASCADE,
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        asset_tag varchar(100) NOT NULL,
        serial_number varchar(100) NOT NULL,
        room_id uuid NOT NULL REFERENCES room(id),
        status varchar(20) NOT NULL,
        brand varchar(255) NOT NULL,
        model varchar(255) NOT NULL,
        processor varchar(255) NOT NULL,
        memory_description varchar(255) NOT NULL,
        operating_system varchar(255) NOT NULL,
        -- RULE-DEV-05: informative/inventory only, never authorization —
        -- reuses 'course', the same "curso/departamento" concept
        -- class_group.course_id already established.
        course_id uuid NOT NULL REFERENCES course(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT institutional_machine_status_check
          CHECK (status IN ('active', 'maintenance', 'decommissioned', 'stolen')),
        -- Not a business rule (RULE-DEV-04 doesn't say patrimônio/série must
        -- be unique) — a Database Agent integrity decision: an asset tag /
        -- serial number is an identifier for one physical machine, so two
        -- inventory rows sharing one is always a data-entry error.
        CONSTRAINT institutional_machine_asset_tag_unique UNIQUE (tenant_id, asset_tag),
        CONSTRAINT institutional_machine_serial_number_unique UNIQUE (tenant_id, serial_number)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX institutional_machine_room_id_idx ON institutional_machine (room_id)
    `);
    await enableRls('institutional_machine');
    await grant('institutional_machine');

    // -----------------------------------------------------------------
    // 3. personal_device — BYOD (RULE-DEV-02). Deliberately enxuto: no
    // inventory fields, RULE-DEV-04 never applies here.
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE personal_device (
        id uuid PRIMARY KEY REFERENCES device_identity(id) ON DELETE CASCADE,
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        label varchar(255),
        revoked_at timestamptz,
        -- RULE-DEV-18: revoked by the owner themself or by the inventory
        -- administrator (Direção/Reitoria, RULE-DEV-15) — who exactly is
        -- resolved by application code from the caller's JWT, this column
        -- just records the outcome.
        revoked_by_person_id uuid REFERENCES person(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT personal_device_revoked_pair_check
          CHECK ((revoked_at IS NULL) = (revoked_by_person_id IS NULL))
      )
    `);
    // RULE-DEV-17: at most one BYOD per person at a time, DB-enforced
    // (partial unique index over active — i.e. non-revoked — rows), the
    // same "constraint, not just a WHERE" treatment RULE-DEV-07 gets below.
    await queryRunner.query(`
      CREATE UNIQUE INDEX personal_device_one_active_per_person_unique
      ON personal_device (tenant_id, person_id)
      WHERE revoked_at IS NULL
    `);
    await enableRls('personal_device');
    await grant('personal_device');

    // -----------------------------------------------------------------
    // 4. device_credential — WebAuthn credential (RULE-DEV-01), shared
    // shape for institutional_machine and personal_device via
    // device_identity_id (Tech Decision A: @simplewebauthn/server). No
    // SECURITY DEFINER escape hatch needed here (unlike device/refresh_token/
    // person_credential): Tech Decision fixed the WebAuthn ceremony to
    // always happen AFTER the person is already authenticated, so
    // app.tenant_id is always already set when this table is read/written.
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE device_credential (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        device_identity_id uuid NOT NULL REFERENCES device_identity(id) ON DELETE CASCADE,
        -- Base64url WebAuthn credential ID (@simplewebauthn's 'id') — opaque,
        -- length varies by authenticator, so text rather than a fixed varchar.
        credential_id text NOT NULL,
        -- Raw COSE public key bytes (@simplewebauthn's 'publicKey'), never a
        -- symmetric secret, so no hashing (unlike refresh_token/device
        -- api_key_secret_hash) — it must be readable back to verify a
        -- signature, not compared as a shared secret.
        public_key bytea NOT NULL,
        -- Anti-replay signature counter (RULE-DEV-01) — must only ever
        -- increase; enforced by application logic at verification time
        -- (@simplewebauthn's own check), this column just persists it.
        counter bigint NOT NULL DEFAULT 0,
        transports text[],
        backed_up boolean NOT NULL DEFAULT false,
        device_type varchar(20),
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        revoked_at timestamptz,
        CONSTRAINT device_credential_status_check CHECK (status IN ('active', 'revoked')),
        CONSTRAINT device_credential_revoked_pair_check
          CHECK ((status = 'revoked') = (revoked_at IS NOT NULL)),
        CONSTRAINT device_credential_device_type_check
          CHECK (device_type IS NULL OR device_type IN ('singleDevice', 'multiDevice')),
        CONSTRAINT device_credential_credential_id_unique UNIQUE (tenant_id, credential_id)
      )
    `);
    // RULE-DEV-01 exception (reimage/formatação erases the credential, a
    // new matrícula is required): at most one ACTIVE credential per
    // identity at a time, so verification never has to disambiguate between
    // two live credentials for the same machine/BYOD. A reimage revokes the
    // old row (status='revoked') and inserts a fresh active one — history
    // preserved, same posture as the rest of this codebase (e.g.
    // class_session.status='cancelled' rows are kept, not deleted).
    await queryRunner.query(`
      CREATE UNIQUE INDEX device_credential_one_active_per_identity_unique
      ON device_credential (device_identity_id)
      WHERE status = 'active'
    `);
    await queryRunner.query(`
      CREATE INDEX device_credential_device_identity_id_idx ON device_credential (device_identity_id)
    `);
    await enableRls('device_credential');
    await grant('device_credential');

    // -----------------------------------------------------------------
    // 5. device_binding — pessoa<->máquina ciclo de vida (RULE-DEV-06/07/08).
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE device_binding (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        device_identity_id uuid NOT NULL REFERENCES device_identity(id) ON DELETE RESTRICT,
        status varchar(20) NOT NULL DEFAULT 'active',
        started_at timestamptz NOT NULL DEFAULT now(),
        checked_out_at timestamptz,
        checkout_reason varchar(30),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT device_binding_status_check CHECK (status IN ('active', 'checked_out')),
        CONSTRAINT device_binding_checkout_reason_check
          CHECK (checkout_reason IS NULL
            OR checkout_reason IN ('logout', 'session_end', 'inactivity_timeout', 'token_expired')),
        -- Pairs status with its two checkout-only columns — also what makes
        -- the Solution Architect's idempotent
        -- "UPDATE device_binding SET status='checked_out', checked_out_at=...,
        -- checkout_reason=... WHERE id=... AND status='active'" the only way
        -- to legally transition a row: any of the four RULE-DEV-06 triggers
        -- racing to run that UPDATE first wins; the rest find status already
        -- 'checked_out' and no-op.
        CONSTRAINT device_binding_checkout_pair_check CHECK (
          (status = 'active' AND checked_out_at IS NULL AND checkout_reason IS NULL)
          OR (status = 'checked_out' AND checked_out_at IS NOT NULL AND checkout_reason IS NOT NULL)
        ),
        CONSTRAINT device_binding_checkout_after_start_check
          CHECK (checked_out_at IS NULL OR checked_out_at >= started_at)
      )
    `);
    // RULE-DEV-07: one active institutional-device binding per person, DB-
    // enforced so two concurrent logins on two different machines can never
    // both succeed — exactly the kind of rule a WHERE clause in application
    // code cannot make race-proof by itself.
    await queryRunner.query(`
      CREATE UNIQUE INDEX device_binding_one_active_per_person_unique
      ON device_binding (tenant_id, person_id)
      WHERE status = 'active'
    `);
    // Motor de Regras (RULE-DEV-09) reads: "for this person, does any
    // binding (active or already checked out) overlap this class_session's
    // window" — a person_id + started_at range scan, checked_out_at
    // compared in the query itself (bindings per person are few, no need
    // for a second indexed column here).
    await queryRunner.query(`
      CREATE INDEX device_binding_person_started_at_idx ON device_binding (tenant_id, person_id, started_at)
    `);
    // RULE-DEV-13/RULE-ACC-08 read ("who is/was on this machine") and
    // RULE-DEV-08's patrimonial-responsibility history query.
    await queryRunner.query(`
      CREATE INDEX device_binding_device_identity_id_idx ON device_binding (tenant_id, device_identity_id)
    `);
    await enableRls('device_binding');
    await grant('device_binding');

    // -----------------------------------------------------------------
    // 6. device_binding_config — RULE-DEV-06 gatilho 3's configurable
    // inactivity threshold. Tenant-scoped, deliberately its own table, NOT
    // a column on attendance_config (Solution Architect: "domínios
    // diferentes: higiene de sessão vs. política de apuração"). One row per
    // tenant — unlike attendance_config there is no evidence of a need for
    // course/turma-level scoping here, so this does not reuse that table's
    // scope_type/scope_id shape.
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE device_binding_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL UNIQUE REFERENCES tenant(id),
        inactivity_timeout_minutes int NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT device_binding_config_inactivity_timeout_minutes_check
          CHECK (inactivity_timeout_minutes > 0)
      )
    `);
    await enableRls('device_binding_config');
    await grant('device_binding_config');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS device_binding_config CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS device_binding CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS device_credential CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS personal_device CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS institutional_machine CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS device_identity CASCADE');
  }
}
