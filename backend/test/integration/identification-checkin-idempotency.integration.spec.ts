import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { IdentificationService } from '../../src/modules/identification/identification.service';
import { IngestionEventType } from '../../src/modules/ingestion/dto/ingestion-event-type.enum';
import { QueueService } from '../../src/queue/queue.service';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// The Identification worker is idempotent against pg-boss's at-least-once job
// delivery via a unique constraint on identification_checkin.raw_identification_event_id
// (see AddPersonFacialReference migration) — verified here against the real
// IdentificationService + real Postgres, only pg-boss stubbed out.
describe('IdentificationService checkin idempotency (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenantContext: TenantContextService;
  let queueStub: QueueService;
  let tenant: TenantFixture;
  let rawEventId: string;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'Identification');

    const deviceResult = await superuser.query(
      `INSERT INTO device (tenant_id, device_type, external_identifier, api_key_id, api_key_secret_hash)
       VALUES ($1, 'raspberry_pi', 'identification-test-device', $2, 'unused-hash')
       RETURNING id`,
      [tenant.tenantId, `identification-test-key-${Date.now()}`],
    );
    const deviceId = deviceResult.rows[0].id as string;

    const wristbandCategoryResult = await superuser.query(
      `INSERT INTO wristband_category (tenant_id, name) VALUES ($1, 'Standard') RETURNING id`,
      [tenant.tenantId],
    );
    const wristbandCategoryId = wristbandCategoryResult.rows[0].id as string;

    const tagCode = `TAG-IDENT-${Date.now()}`;
    await superuser.query(
      `INSERT INTO wristband (tenant_id, person_id, wristband_category_id, tag_code) VALUES ($1, $2, $3, $4)`,
      [tenant.tenantId, tenant.personId, wristbandCategoryId, tagCode],
    );

    const rawEventResult = await superuser.query(
      `INSERT INTO raw_identification_event (tenant_id, device_id, event_type, idempotency_key, raw_payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        tenant.tenantId,
        deviceId,
        IngestionEventType.TAG_CHECKIN,
        `idem-identification-${Date.now()}`,
        JSON.stringify({ capturedAt: new Date().toISOString(), roomId: null, data: { tagCode } }),
      ],
    );
    rawEventId = rawEventResult.rows[0].id as string;

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

  test('test_processRawEvent_calledTwiceForSameRawEvent_insertsOnlyOneIdentificationCheckin', async () => {
    const identificationService = new IdentificationService(tenantContext, queueStub);

    await tenantContext.runWithTenant(tenant.tenantId, () => identificationService.processRawEvent(rawEventId));
    await tenantContext.runWithTenant(tenant.tenantId, () => identificationService.processRawEvent(rawEventId));

    const rows = await superuser.query(
      'SELECT id, person_id FROM identification_checkin WHERE raw_identification_event_id = $1',
      [rawEventId],
    );
    expect(rows.rows).toHaveLength(1);
    expect(rows.rows[0].person_id).toBe(tenant.personId);

    // Job enqueued on the first (real) insert only — the second call's
    // .orIgnore() produced no new checkin id, so nothing should be enqueued
    // again for it.
    expect((queueStub.sendWithManager as jest.Mock)).toHaveBeenCalledTimes(1);
  });
});
