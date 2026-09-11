import { MigrationInterface, QueryRunner } from 'typeorm';

// GAP-10 (RULE-DEV-14) — "Decisão de tecnologia — Detecção de rede
// institucional / GAP-10 (2026-09-11)"
// (project-knowledge/references/architecture-overview.md): allowlist of
// IP/CIDR ranges an institution declares as "inside the institutional
// network". Only the data layer is built in this round — the matching
// service (InstitutionalNetworkService, Backend Agent) and both of its call
// sites (device-binding creation, the future Frente 13 login-decision flow)
// are explicitly out of scope here; nothing in device-binding.service.ts is
// touched by this migration.
//
// Shape decision: N rows per tenant, not one. Unlike device_binding_config
// (a single "one row per tenant" settings table), an institution can have
// more than one range in play at once (main building + annex, a different
// WAN for guest Wi-Fi vs. the academic network) — RULE-DEV-14 never says
// "a" range, and the Tech Decision's own wording ("uma ou mais faixas CIDR")
// anticipates this. tenant_id alone is therefore NOT unique here; only the
// (tenant_id, cidr) pair is.
//
// cidr is the native Postgres type, not varchar + a regex CHECK — it
// rejects malformed CIDR notation and rejects a network address with host
// bits set (e.g. '192.168.1.5/24', a host address rather than a range) at
// write time, for both IPv4 and IPv6, which is strictly stronger validation
// than a hand-written format check.
export class AddInstitutionalNetworkRange1755872000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    await queryRunner.query(`
      CREATE TABLE institutional_network_range (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        cidr cidr NOT NULL,
        label varchar(255),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        -- Not a business rule (RULE-DEV-14 doesn't say ranges must be
        -- unique) — a Database Agent integrity decision, same reasoning as
        -- institutional_machine's asset_tag/serial_number uniqueness: two
        -- rows with the EXACT same range for one tenant is always a
        -- data-entry error. This does not block legitimately overlapping-
        -- but-different ranges (e.g. 10.0.0.0/8 and 10.0.1.0/24 for the same
        -- tenant) — only exact duplicates.
        CONSTRAINT institutional_network_range_tenant_cidr_unique UNIQUE (tenant_id, cidr)
      )
    `);
    // No separate index on tenant_id alone: the composite unique constraint
    // above already leads with tenant_id, so it backs the
    // "WHERE tenant_id = $1" scan the future InstitutionalNetworkService
    // will run (list-all-ranges-for-this-tenant, expected to be a handful of
    // rows) without a redundant second index.

    await queryRunner.query('ALTER TABLE institutional_network_range ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE institutional_network_range FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON institutional_network_range
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON institutional_network_range TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS institutional_network_range CASCADE');
  }
}
