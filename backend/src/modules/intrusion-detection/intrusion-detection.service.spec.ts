import {
  IntrusionIncidentEntity,
  IntrusionIncidentLocationEntryEntity,
  RawSecurityEventEntity,
} from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { SecurityIngestionEventType } from '../security-ingestion/security-ingestion-event-type.enum';
import { IntrusionDetectionService } from './intrusion-detection.service';

// Covers the Motor de Detecção de Intrusão's core decisions: what counts as
// a candidate intrusion signal (RULE-SEC-01's note) and the confirmed
// "index case" correlation behavior — a new signal while an incident is
// open joins that SAME incident, never opens a second one.
describe('IntrusionDetectionService', () => {
  const rawAreaReaderEvent = {
    id: 'raw-event-1',
    tenantId: 'tenant-a-id',
    deviceId: 'device-1',
    eventType: SecurityIngestionEventType.AREA_READER_SCAN,
    areaId: 'area-1',
    capturedAt: new Date('2026-08-23T10:00:00Z'),
    idempotencyKey: 'idem-1',
    rawPayload: { tagCode: 'TAG-1' },
  } as RawSecurityEventEntity;

  const rawIrBarrierEvent = {
    ...rawAreaReaderEvent,
    id: 'raw-event-2',
    eventType: SecurityIngestionEventType.IR_BARRIER_CROSSING,
    rawPayload: {},
  } as RawSecurityEventEntity;

  function buildService(options: {
    rawEvent: RawSecurityEventEntity | null;
    wristbandIdentityResult: { personId: string; wristbandCategoryId: string } | null;
    isAuthorizedResult?: boolean;
    openIncident?: IntrusionIncidentEntity | null;
    incidentSaveResult?: Partial<IntrusionIncidentEntity>;
  }) {
    const rawEventRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.rawEvent) });
    const incidentRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.openIncident ?? null),
      save: jest.fn().mockResolvedValue(options.incidentSaveResult ?? { id: 'incident-new' }),
    });
    const locationRepo = createMockRepository();

    const manager = createMockEntityManager(
      new Map([
        [RawSecurityEventEntity, rawEventRepo],
        [IntrusionIncidentEntity, incidentRepo],
        [IntrusionIncidentLocationEntryEntity, locationRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const wristbandIdentity = { resolveByTagCode: jest.fn().mockResolvedValue(options.wristbandIdentityResult) };
    const areaAuthorization = { isAuthorized: jest.fn().mockResolvedValue(options.isAuthorizedResult ?? false) };

    const service = new IntrusionDetectionService(tenantContext as never, wristbandIdentity as never, areaAuthorization as never);
    return { service, incidentRepo, locationRepo, wristbandIdentity, areaAuthorization };
  }

  test('test_processRawEvent_areaReaderScanAuthorized_doesNothing', async () => {
    const { service, incidentRepo, locationRepo } = buildService({
      rawEvent: rawAreaReaderEvent,
      wristbandIdentityResult: { personId: 'person-1', wristbandCategoryId: 'category-1' },
      isAuthorizedResult: true,
    });

    await service.processRawEvent('raw-event-1');

    expect(incidentRepo.findOneBy).not.toHaveBeenCalled();
    expect(locationRepo.save).not.toHaveBeenCalled();
  });

  test('test_processRawEvent_areaReaderScanUnresolvedTag_opensNewIncidentWithNullIdentity', async () => {
    const { service, incidentRepo, locationRepo } = buildService({
      rawEvent: rawAreaReaderEvent,
      wristbandIdentityResult: null,
      openIncident: null,
      incidentSaveResult: { id: 'incident-new' },
    });

    await service.processRawEvent('raw-event-1');

    expect(incidentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ personId: null, wristbandCategoryId: null, currentAreaId: 'area-1', status: 'open' }),
    );
    expect(locationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ intrusionIncidentId: 'incident-new', rawSecurityEventId: 'raw-event-1', areaId: 'area-1' }),
    );
  });

  test('test_processRawEvent_areaReaderScanResolvedButUnauthorized_opensNewIncidentWithResolvedIdentity', async () => {
    const { service, incidentRepo } = buildService({
      rawEvent: rawAreaReaderEvent,
      wristbandIdentityResult: { personId: 'person-1', wristbandCategoryId: 'category-1' },
      isAuthorizedResult: false,
      openIncident: null,
      incidentSaveResult: { id: 'incident-new' },
    });

    await service.processRawEvent('raw-event-1');

    expect(incidentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ personId: 'person-1', wristbandCategoryId: 'category-1', currentAreaId: 'area-1' }),
    );
  });

  test('test_processRawEvent_irBarrierCrossing_isAlwaysACandidateSignal', async () => {
    const { service, incidentRepo } = buildService({
      rawEvent: rawIrBarrierEvent,
      wristbandIdentityResult: null,
      openIncident: null,
      incidentSaveResult: { id: 'incident-new' },
    });

    await service.processRawEvent('raw-event-2');

    expect(incidentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ personId: null, wristbandCategoryId: null }));
  });

  test('test_processRawEvent_openIncidentExists_appendsLocationEntryAndUpdatesCurrentAreaInsteadOfOpeningSecondIncident', async () => {
    const openIncident = { id: 'incident-open' } as IntrusionIncidentEntity;
    const { service, incidentRepo, locationRepo } = buildService({
      rawEvent: rawIrBarrierEvent,
      wristbandIdentityResult: null,
      openIncident,
    });

    await service.processRawEvent('raw-event-2');

    expect(incidentRepo.save).not.toHaveBeenCalled();
    expect(incidentRepo.update).toHaveBeenCalledWith({ id: 'incident-open' }, { currentAreaId: 'area-1' });
    expect(locationRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ intrusionIncidentId: 'incident-open', rawSecurityEventId: 'raw-event-2', areaId: 'area-1' }),
    );
  });

  test('test_processRawEvent_rawEventNotFound_logsAndReturnsWithoutTouchingIncidents', async () => {
    const { service, incidentRepo } = buildService({ rawEvent: null, wristbandIdentityResult: null });

    await service.processRawEvent('missing-event');

    expect(incidentRepo.findOneBy).not.toHaveBeenCalled();
  });
});
