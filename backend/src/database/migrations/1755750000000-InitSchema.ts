import { MigrationInterface, QueryRunner } from 'typeorm';

// Initial schema for the CheckClass attendance core, per the data model
// approved 2026-08-21 (see project-knowledge/references/architecture-overview.md).
// Every tenant-scoped table gets tenant_id + RLS enforced at the database
// level (RULE-TEN-01) — the `tenant` table itself is the tenant registry and
// has no tenant_id of its own, so it is not RLS-scoped the same way.
export class InitSchema1755750000000 implements MigrationInterface {
  private readonly tenantScopedTables = [
    'actor_type',
    'person',
    'leadership_role',
    'leadership_assignment',
    'wristband_category',
    'wristband',
    'room',
    'course',
    'class_group',
    'class_group_enrollment',
    'class_session',
    'device',
    'attendance_config',
    'attendance_config_required_factor',
    'raw_identification_event',
    'identification_checkin',
    'presence_interval',
    'session_attendance_consolidation',
    'attendance_pending_review',
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await queryRunner.query(`
      CREATE TABLE tenant (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(255) NOT NULL,
        institution_type varchar(50) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE actor_type (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        code varchar(50) NOT NULL,
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE person (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        actor_type_id uuid NOT NULL REFERENCES actor_type(id),
        full_name varchar(255) NOT NULL,
        email varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE leadership_role (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        name varchar(255) NOT NULL,
        rank int NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE course (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        name varchar(255) NOT NULL,
        code varchar(50),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE leadership_assignment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        leadership_role_id uuid NOT NULL REFERENCES leadership_role(id),
        course_id uuid REFERENCES course(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE wristband_category (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE wristband (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        wristband_category_id uuid NOT NULL REFERENCES wristband_category(id),
        tag_code varchar(255) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, tag_code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE room (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE class_group (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        course_id uuid NOT NULL REFERENCES course(id),
        name varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE class_group_enrollment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        person_id uuid NOT NULL REFERENCES person(id),
        role varchar(50) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (class_group_id, person_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE device (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        room_id uuid REFERENCES room(id),
        device_type varchar(50) NOT NULL,
        external_identifier varchar(255) NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (tenant_id, external_identifier)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE attendance_factor_type (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid REFERENCES tenant(id),
        code varchar(50) NOT NULL,
        name varchar(255) NOT NULL,
        is_custom boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE class_session (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        room_id uuid NOT NULL REFERENCES room(id),
        scheduled_start timestamptz NOT NULL,
        scheduled_end timestamptz NOT NULL,
        min_attendance_percentage_snapshot numeric(5,2) NOT NULL,
        tolerance_minutes_snapshot int NOT NULL,
        post_tolerance_behavior_snapshot varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE attendance_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        scope_type varchar(20) NOT NULL,
        scope_id uuid,
        min_attendance_percentage numeric(5,2) NOT NULL,
        tolerance_minutes int NOT NULL,
        post_tolerance_behavior varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE attendance_config_required_factor (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        attendance_config_id uuid NOT NULL REFERENCES attendance_config(id),
        attendance_factor_type_id uuid NOT NULL REFERENCES attendance_factor_type(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (attendance_config_id, attendance_factor_type_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE raw_identification_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        device_id uuid NOT NULL REFERENCES device(id),
        event_type varchar(30) NOT NULL,
        idempotency_key varchar(255) NOT NULL,
        raw_payload jsonb NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (idempotency_key)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE identification_checkin (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        raw_identification_event_id uuid NOT NULL REFERENCES raw_identification_event(id),
        person_id uuid NOT NULL REFERENCES person(id),
        class_session_id uuid REFERENCES class_session(id),
        attendance_factor_type_id uuid NOT NULL REFERENCES attendance_factor_type(id),
        checkin_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE presence_interval (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_session_id uuid NOT NULL REFERENCES class_session(id),
        person_id uuid NOT NULL REFERENCES person(id),
        entry_at timestamptz NOT NULL,
        exit_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE session_attendance_consolidation (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_session_id uuid NOT NULL REFERENCES class_session(id),
        person_id uuid NOT NULL REFERENCES person(id),
        total_presence_minutes int NOT NULL,
        attendance_percentage numeric(5,2) NOT NULL,
        status varchar(20) NOT NULL,
        resolved_by_person_id uuid REFERENCES person(id),
        resolved_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (class_session_id, person_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE attendance_pending_review (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_session_id uuid NOT NULL REFERENCES class_session(id),
        person_id uuid NOT NULL REFERENCES person(id),
        reason varchar(30) NOT NULL,
        resolved_by_person_id uuid REFERENCES person(id),
        resolved_at timestamptz,
        resolution_note text,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // RULE-TEN-01: tenant isolation enforced by the database itself, not just
    // application discipline. FORCE ROW LEVEL SECURITY makes the policy apply
    // even to the table owner, so an ORM bug can't silently bypass it.
    for (const table of this.tenantScopedTables) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }

    // attendance_factor_type is the one exception (RULE-ATT-13): tenant_id is
    // nullable, and a tenant must see both its own custom factors and the
    // platform's shared standard factors (tenant_id IS NULL).
    await queryRunner.query('ALTER TABLE attendance_factor_type ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE attendance_factor_type FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON attendance_factor_type
      USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    // Row-Level Security is never enforced against a superuser or a role with
    // BYPASSRLS, no matter what FORCE ROW LEVEL SECURITY says (Postgres docs).
    // The docker-official Postgres image creates its bootstrap user (the one
    // in DB_USERNAME/DB_PASSWORD, used here to run migrations) as a superuser,
    // so the application itself must connect through a separate, unprivileged
    // role for RLS to actually isolate tenants (RULE-TEN-01).
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    // Security review finding: silently defaulting to a predictable password
    // here (this migration doesn't go through the Nest app's validateEnv,
    // which only runs at HTTP-server boot) meant a fresh/CI environment
    // missing this var would get a role with a guessable password that
    // IF NOT EXISTS then protects from ever being rotated by a later fix.
    // Fail loudly instead — this must be set explicitly, same as any other
    // real credential.
    if (!process.env.APP_DB_PASSWORD) {
      throw new Error(
        'APP_DB_PASSWORD is not set — refusing to create the checkclass_app role with a default/guessable password. Set it in .env before running migrations.',
      );
    }
    const appDbPassword = process.env.APP_DB_PASSWORD.replace(/'/g, "''");

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${appDbUsername}') THEN
          CREATE ROLE ${appDbUsername} LOGIN PASSWORD '${appDbPassword}'
            NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END
      $$;
    `);
    await queryRunner.query(`GRANT USAGE ON SCHEMA public TO ${appDbUsername}`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${appDbUsername}`);
    await queryRunner.query(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${appDbUsername}') THEN
          EXECUTE 'DROP OWNED BY ${appDbUsername}';
          EXECUTE 'DROP ROLE ${appDbUsername}';
        END IF;
      END
      $$;
    `);

    const dropOrder = [
      'attendance_pending_review',
      'session_attendance_consolidation',
      'presence_interval',
      'identification_checkin',
      'raw_identification_event',
      'attendance_config_required_factor',
      'attendance_config',
      'class_session',
      'attendance_factor_type',
      'device',
      'class_group_enrollment',
      'class_group',
      'room',
      'wristband',
      'wristband_category',
      'leadership_assignment',
      'course',
      'leadership_role',
      'person',
      'actor_type',
      'tenant',
    ];

    for (const table of dropOrder) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }
}
