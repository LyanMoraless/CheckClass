import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { IngestionEventType } from '../../src/modules/ingestion/dto/ingestion-event-type.enum';
import { IngestionEventEnvelopeDto } from '../../src/modules/ingestion/dto/ingestion-event-envelope.dto';
import { IngestionService } from '../../src/modules/ingestion/ingestion.service';
import { QueueService } from '../../src/queue/queue.service';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// RULE-ATT-10 (first valid event wins): the identification_checkin unique
// idempotency_key constraint is what actually enforces this — verified here
// against the real IngestionService + real Postgres, only pg-boss (an
// unrelated external system) stubbed out.
describe('IngestionService idempotency (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenantContext: TenantContextService;
  let queueStub: QueueService;
  let tenant: TenantFixture;
  let deviceId: string;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'Ingestion');

    const deviceResult = await superuser.query(
      `INSERT INTO device (tenant_id, device_type, external_identifier, api_key_id, api_key_secret_hash)
       VALUES ($1, 'raspberry_pi', 'ingestion-test-device', $2, 'unused-hash')
       RETURNING id`,
      [tenant.tenantId, `ingestion-test-key-${Date.now()}`],
    );
    deviceId = deviceResult.rows[0].id as string;

    dataSource = createAppDataSource();
    await dataSource.initialize();
    tenantContext = new TenantContextService(dataSource);
    queueStub = { sendWithManager: jest.fn().mockResolvedValue(undefined) } as unknown as QueueService;
  });

  afterAll(async () => {
    await dataSource.destroy();
    await cleanupTenants(superuser, [tenant.tenantId]);
    await superuser.end();
  });

  function buildEnvelope(idempotencyKey: string): IngestionEventEnvelopeDto {
    const envelope = new IngestionEventEnvelopeDto();
    envelope.idempotencyKey = idempotencyKey;
    envelope.eventType = IngestionEventType.TAG_CHECKIN;
    envelope.capturedAt = new Date().toISOString();
    envelope.data = { tagCode: 'TAG-INGESTION-TEST' };
    return envelope;
  }

  test('test_ingest_duplicateIdempotencyKey_returnsExistingEventInsteadOfInsertingSecondRow', async () => {
    const ingestionService = new IngestionService(tenantContext, queueStub);
    const idempotencyKey = `idem-${randomUUID()}`;

    const first = await tenantContext.runWithTenant(tenant.tenantId, () =>
      ingestionService.ingest(deviceId, buildEnvelope(idempotencyKey)),
    );
    const second = await tenantContext.runWithTenant(tenant.tenantId, () =>
      ingestionService.ingest(deviceId, buildEnvelope(idempotencyKey)),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.eventId).toBe(first.eventId);

    const rows = await superuser.query('SELECT id FROM raw_identification_event WHERE idempotency_key = $1', [
      idempotencyKey,
    ]);
    expect(rows.rows).toHaveLength(1);
  });

  test('test_ingest_differentIdempotencyKeys_createsSeparateRowsForEach', async () => {
    const ingestionService = new IngestionService(tenantContext, queueStub);
    const keyOne = `idem-${randomUUID()}`;
    const keyTwo = `idem-${randomUUID()}`;

    const first = await tenantContext.runWithTenant(tenant.tenantId, () =>
      ingestionService.ingest(deviceId, buildEnvelope(keyOne)),
    );
    const second = await tenantContext.runWithTenant(tenant.tenantId, () =>
      ingestionService.ingest(deviceId, buildEnvelope(keyTwo)),
    );

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(first.eventId).not.toBe(second.eventId);
  });
});
