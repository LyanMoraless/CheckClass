import { AreaEntity, RawSecurityEventEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockInsertQueryBuilder,
  createMockRepository,
  createMockTenantContext,
} from '../../../test/unit/support/mock-entity-manager';
import { DETECT_INTRUSION_QUEUE } from '../intrusion-detection/detect-intrusion.job';
import { SecurityIngestionEventType } from './security-ingestion-event-type.enum';
import { SecurityIngestionService } from './security-ingestion.service';

// Mirrors the insert-or-ignore/transactional-outbox coverage this codebase
// keeps at integration level for IngestionService — exercised here at the
// unit level instead since SecurityIngestionService has no equivalent
// integration spec yet.
describe('SecurityIngestionService', () => {
  function buildService(
    options: { insertedId?: string | null; existing?: RawSecurityEventEntity; area?: AreaEntity | null } = {},
  ) {
    const rawEventRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.existing ?? null) });
    // Defaults to "area exists" so every test not specifically about the
    // area-tenant guard doesn't have to know about it.
    const areaRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.area === undefined ? ({ id: 'area-1' } as AreaEntity) : options.area),
    });
    const manager = createMockEntityManager(
      new Map<unknown, ReturnType<typeof createMockRepository>>([
        [RawSecurityEventEntity, rawEventRepo],
        [AreaEntity, areaRepo],
      ]),
    );
    // options.insertedId === undefined means "not specified, default to a
    // fresh successful insert" — options.insertedId === null (explicit) means
    // "simulate losing the orIgnore race", so `??` (which treats both the
    // same) can't be used here.
    const insertedId = options.insertedId === undefined ? 'raw-event-1' : options.insertedId;
    manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(insertedId));

    const tenantContext = createMockTenantContext(manager);
    const queue = { sendWithManager: jest.fn().mockResolvedValue(undefined) };
    const service = new SecurityIngestionService(tenantContext as never, queue as never);
    return { service, manager, queue, rawEventRepo };
  }

  const areaReaderEnvelope = {
    idempotencyKey: 'idem-1',
    eventType: SecurityIngestionEventType.AREA_READER_SCAN,
    capturedAt: '2026-08-23T10:00:00.000Z',
    areaId: 'area-1',
    data: { tagCode: 'TAG-1' },
  };

  test('test_ingest_newEvent_insertsAndEnqueuesDetectIntrusionJob', async () => {
    const { service, queue } = buildService({ insertedId: 'raw-event-1' });

    const result = await service.ingest('device-1', areaReaderEnvelope);

    expect(result).toEqual({ created: true, eventId: 'raw-event-1' });
    expect(queue.sendWithManager).toHaveBeenCalledWith(
      DETECT_INTRUSION_QUEUE,
      { rawEventId: 'raw-event-1', tenantId: 'tenant-a-id' },
      expect.anything(),
    );
  });

  test('test_ingest_duplicateIdempotencyKey_returnsExistingEventWithoutEnqueueing', async () => {
    const existing = { id: 'raw-event-existing' } as RawSecurityEventEntity;
    const { service, queue } = buildService({ insertedId: null, existing });

    const result = await service.ingest('device-1', areaReaderEnvelope);

    expect(result).toEqual({ created: false, eventId: 'raw-event-existing' });
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  test('test_ingest_irBarrierCrossingWithEmptyData_insertsSuccessfully', async () => {
    const { service } = buildService({ insertedId: 'raw-event-2' });

    const result = await service.ingest('device-1', {
      idempotencyKey: 'idem-2',
      eventType: SecurityIngestionEventType.IR_BARRIER_CROSSING,
      capturedAt: '2026-08-23T10:00:00.000Z',
      areaId: 'area-1',
      data: {},
    });

    expect(result).toEqual({ created: true, eventId: 'raw-event-2' });
  });

  test('test_ingest_invalidDataForEventType_throwsWithoutInsertingOrEnqueueing', async () => {
    const { service, manager, queue } = buildService();

    await expect(
      service.ingest('device-1', {
        idempotencyKey: 'idem-3',
        eventType: SecurityIngestionEventType.AREA_READER_SCAN,
        capturedAt: '2026-08-23T10:00:00.000Z',
        areaId: 'area-1',
        data: {},
      }),
    ).rejects.toThrow();

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });

  // Regression test: areaId used to be trusted as-is with no tenant-scoped
  // existence check, so a device from another tenant could reference an
  // areaId belonging to a different tenant (area's FK has no tenant pairing,
  // and FK checks bypass RLS) — same guard CameraService.create already
  // applies to its own areaId input.
  test('test_ingest_areaDoesNotResolveForTenant_throwsNotFoundWithoutInsertingOrEnqueueing', async () => {
    const { service, manager, queue } = buildService({ area: null });

    await expect(service.ingest('device-1', areaReaderEnvelope)).rejects.toThrow('area area-1 not found');

    expect(manager.createQueryBuilder).not.toHaveBeenCalled();
    expect(queue.sendWithManager).not.toHaveBeenCalled();
  });
});
