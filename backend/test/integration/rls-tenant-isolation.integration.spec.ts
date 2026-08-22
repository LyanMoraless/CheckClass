import { Client } from 'pg';
import {
  cleanupTenants,
  createAppRoleClient,
  createSuperuserClient,
  createTenantWithPerson,
  TenantFixture,
} from './support/db';

// RULE-TEN-01: tenant isolation is enforced by Postgres RLS itself, not just
// application discipline (see InitSchema migration). This is the single
// safety-critical property of the whole system — verified here against a
// real database and the real unprivileged app role, not a mock.
describe('RLS tenant isolation (real Postgres)', () => {
  let superuser: Client;
  let tenantA: TenantFixture;
  let tenantB: TenantFixture;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenantA = await createTenantWithPerson(superuser, 'RLS-A');
    tenantB = await createTenantWithPerson(superuser, 'RLS-B');
  });

  afterAll(async () => {
    await cleanupTenants(superuser, [tenantA.tenantId, tenantB.tenantId]);
    await superuser.end();
  });

  async function connectAsAppRole(): Promise<Client> {
    const client = createAppRoleClient();
    await client.connect();
    return client;
  }

  async function setTenantContext(client: Client, tenantId: string): Promise<void> {
    // Session-scoped SET (is_local = false): a dedicated pg Client here
    // stands in for "one request's connection", mirroring the effect of
    // TenantContextService's SET LOCAL within its transaction, but simpler to
    // drive directly for a test that's specifically about the DB policy.
    await client.query("SELECT set_config('app.tenant_id', $1, false)", [tenantId]);
  }

  test('test_personQuery_tenantAContext_seesOnlyTenantARow', async () => {
    const client = await connectAsAppRole();
    try {
      await setTenantContext(client, tenantA.tenantId);
      const result = await client.query('SELECT id, tenant_id FROM person');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(tenantA.personId);
    } finally {
      await client.end();
    }
  });

  test('test_personQuery_tenantBContext_seesOnlyTenantBRow_notTenantAs', async () => {
    const client = await connectAsAppRole();
    try {
      await setTenantContext(client, tenantB.tenantId);
      const result = await client.query('SELECT id, tenant_id FROM person');
      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe(tenantB.personId);
      expect(result.rows.map((r) => r.id)).not.toContain(tenantA.personId);
    } finally {
      await client.end();
    }
  });

  test('test_personQuery_noTenantContextEverSet_returnsZeroRows', async () => {
    // Fail-closed default: a fresh connection that never called set_config at
    // all must see nothing, even though rows exist for both tenants.
    const client = await connectAsAppRole();
    try {
      const result = await client.query('SELECT id FROM person');
      expect(result.rows).toHaveLength(0);
    } finally {
      await client.end();
    }
  });

  test('test_personInsert_crossTenantWrite_isRejectedByRlsPolicy', async () => {
    // With app.tenant_id set to tenant A, attempting to insert a row that
    // claims tenant B's id must violate the WITH CHECK clause of the policy —
    // RLS isn't just a read-side filter.
    const client = await connectAsAppRole();
    try {
      await setTenantContext(client, tenantA.tenantId);
      await expect(
        client.query('INSERT INTO person (tenant_id, actor_type_id, full_name) VALUES ($1, $2, $3)', [
          tenantB.tenantId,
          tenantB.actorTypeId,
          'Cross-tenant write attempt',
        ]),
      ).rejects.toThrow(/row-level security/i);
    } finally {
      await client.end();
    }
  });

  test('test_attendanceFactorType_sharedStandardFactors_visibleRegardlessOfTenantContext', async () => {
    // RULE-ATT-13's exception: tenant_id IS NULL rows (platform-standard
    // factors) must remain visible under any tenant's context, not just to
    // the tenant that happens to match — this is the one table whose policy
    // deliberately isn't a strict per-tenant filter.
    const client = await connectAsAppRole();
    try {
      await setTenantContext(client, tenantA.tenantId);
      const result = await client.query(
        "SELECT code FROM attendance_factor_type WHERE tenant_id IS NULL ORDER BY code",
      );
      expect(result.rows.map((r) => r.code)).toEqual(
        expect.arrayContaining(['CAMERA_COUNT', 'FACIAL_CHECKIN', 'ROOM_ENTRY', 'ROOM_EXIT', 'TAG_CHECKIN']),
      );
    } finally {
      await client.end();
    }
  });
});
