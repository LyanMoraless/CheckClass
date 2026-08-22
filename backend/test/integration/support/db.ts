import 'dotenv/config';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import * as entities from '../../../src/database/entities';

// Fixture setup/cleanup deliberately connects as the migration superuser
// (DB_USERNAME), which Postgres never applies RLS against regardless of
// FORCE ROW LEVEL SECURITY (see InitSchema migration's comment) — so tests
// can freely arrange cross-tenant fixture data without fighting the very
// policy under test.
export function createSuperuserClient(): Client {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
}

// A raw pg Client authenticated as the unprivileged app role — used by the
// RLS spec to drive `set_config('app.tenant_id', ...)` directly and observe
// the database's own policy enforcement, not just the application's plumbing
// around it.
export function createAppRoleClient(): Client {
  return new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.APP_DB_USERNAME,
    password: process.env.APP_DB_PASSWORD,
    database: process.env.DB_DATABASE,
  });
}

// A TypeORM DataSource authenticated as the same unprivileged app role the
// real app runs under (see database.module.ts) — used to run the actual
// service code (IngestionService/IdentificationService) against a real,
// RLS-enforcing connection instead of a mock.
export function createAppDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    username: process.env.APP_DB_USERNAME,
    password: process.env.APP_DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: Object.values(entities),
    synchronize: false,
  });
}

export interface TenantFixture {
  tenantId: string;
  actorTypeId: string;
  personId: string;
}

// Inserts the minimum chain of rows (tenant -> actor_type -> person) a given
// test needs, via the superuser connection. Returns the ids so the test can
// both drive the scenario and clean up afterward.
export async function createTenantWithPerson(superuser: Client, label: string): Promise<TenantFixture> {
  const tenantResult = await superuser.query(
    `INSERT INTO tenant (name, institution_type) VALUES ($1, 'school') RETURNING id`,
    [`Test Tenant ${label} ${Date.now()}`],
  );
  const tenantId = tenantResult.rows[0].id as string;

  const actorTypeResult = await superuser.query(
    `INSERT INTO actor_type (tenant_id, code, name) VALUES ($1, 'STUDENT', 'Student') RETURNING id`,
    [tenantId],
  );
  const actorTypeId = actorTypeResult.rows[0].id as string;

  const personResult = await superuser.query(
    `INSERT INTO person (tenant_id, actor_type_id, full_name) VALUES ($1, $2, $3) RETURNING id`,
    [tenantId, actorTypeId, `Person ${label}`],
  );
  const personId = personResult.rows[0].id as string;

  return { tenantId, actorTypeId, personId };
}

// Reverse-FK-order cleanup for whatever tables a test touched, scoped to the
// given tenant ids. Safe to call with tables that have no rows for these
// tenants (DELETE ... WHERE tenant_id = ANY($1) is a no-op then).
export async function cleanupTenants(superuser: Client, tenantIds: string[]): Promise<void> {
  if (tenantIds.length === 0) {
    return;
  }
  const tenantScopedTablesInDeleteOrder = [
    'attendance_pending_review',
    'session_attendance_consolidation',
    'presence_interval',
    'identification_checkin',
    'raw_identification_event',
    'class_session_required_factor',
    'class_session',
    'attendance_config_required_factor',
    'attendance_config',
    'person_facial_reference',
    'wristband',
    'wristband_category',
    'device',
    'class_group_enrollment',
    'class_group',
    'course',
    'room',
    'leadership_assignment',
    'leadership_role',
    'person',
    'actor_type',
  ];
  for (const table of tenantScopedTablesInDeleteOrder) {
    await superuser.query(`DELETE FROM ${table} WHERE tenant_id = ANY($1::uuid[])`, [tenantIds]);
  }
  await superuser.query(`DELETE FROM tenant WHERE id = ANY($1::uuid[])`, [tenantIds]);
}
