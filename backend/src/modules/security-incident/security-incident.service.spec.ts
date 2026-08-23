import { CameraEntity, IntrusionIncidentEntity, IntrusionIncidentLocationEntryEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { SecurityIncidentService } from './security-incident.service';

// Covers RULE-SEC-07's closure invariants (mandatory note enforced by the
// DTO's IsNotEmpty at the HTTP boundary; double-closure rejected here) and
// the suggestedCameraId derivation for RULE-SEC-03's camera auto-follow.
describe('SecurityIncidentService', () => {
  function buildService(options: {
    incident: IntrusionIncidentEntity | null;
    locationHistory?: IntrusionIncidentLocationEntryEntity[];
    camera?: CameraEntity | null;
  }) {
    const incidentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.incident) });
    const locationRepo = createMockRepository({ find: jest.fn().mockResolvedValue(options.locationHistory ?? []) });
    const cameraRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(options.camera ?? null) });

    const manager = createMockEntityManager(
      new Map([
        [IntrusionIncidentEntity, incidentRepo],
        [IntrusionIncidentLocationEntryEntity, locationRepo],
        [CameraEntity, cameraRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const service = new SecurityIncidentService(tenantContext as never);
    return { service, incidentRepo, cameraRepo };
  }

  test('test_getById_incidentWithCurrentAreaAndMatchingCamera_returnsSuggestedCameraId', async () => {
    const incident = { id: 'incident-1', currentAreaId: 'area-1', status: 'open' } as IntrusionIncidentEntity;
    const camera = { id: 'camera-1', areaId: 'area-1', status: 'active' } as CameraEntity;
    const { service } = buildService({ incident, camera });

    const result = await service.getById('incident-1');

    expect(result.suggestedCameraId).toBe('camera-1');
  });

  test('test_getById_incidentWithNoCurrentArea_returnsNullSuggestedCameraId', async () => {
    const incident = { id: 'incident-1', currentAreaId: null, status: 'open' } as IntrusionIncidentEntity;
    const { service } = buildService({ incident });

    const result = await service.getById('incident-1');

    expect(result.suggestedCameraId).toBeNull();
  });

  test('test_getById_incidentNotFound_throwsNotFound', async () => {
    const { service } = buildService({ incident: null });

    await expect(service.getById('missing')).rejects.toThrow('intrusion_incident missing not found');
  });

  test('test_close_openIncident_updatesStatusOutcomeNoteAndCloser', async () => {
    const incident = { id: 'incident-1', status: 'open' } as IntrusionIncidentEntity;
    const { service, incidentRepo } = buildService({ incident });
    incidentRepo.update = jest.fn().mockResolvedValue({ affected: 1 });

    await service.close('incident-1', 'person-closer', 'resolved', 'Confirmed intrusion, handled by security team');

    // The WHERE clause carries status: 'open' — this IS the atomic guard
    // against double-closure (see the race test below), not just an
    // identity lookup by id.
    expect(incidentRepo.update).toHaveBeenCalledWith(
      { id: 'incident-1', status: 'open' },
      expect.objectContaining({
        status: 'closed',
        outcome: 'resolved',
        resolutionNote: 'Confirmed intrusion, handled by security team',
        closedByPersonId: 'person-closer',
      }),
    );
  });

  test('test_close_alreadyClosedIncident_throwsBadRequestWithAffectedZero', async () => {
    // status read as 'closed' here is the ordinary (non-racing) path: the
    // conditional UPDATE's WHERE (status = 'open') never matches a row, so
    // affected is 0 regardless of read timing.
    const incident = { id: 'incident-1', status: 'closed' } as IntrusionIncidentEntity;
    const { service, incidentRepo } = buildService({ incident });
    incidentRepo.update = jest.fn().mockResolvedValue({ affected: 0 });

    await expect(service.close('incident-1', 'person-closer', 'resolved', 'note')).rejects.toThrow(
      'This intrusion incident has already been closed',
    );
  });

  // TOCTOU race regression test (RULE-SEC-07): mocks can't literally run two
  // requests concurrently, but this exercises the exact combination a real
  // race produces — a stale read that still shows status: 'open' (because
  // this request's read happened before the OTHER request's close
  // committed), yet the atomic conditional UPDATE's WHERE (status = 'open')
  // no longer matches by the time it runs, so affected comes back 0. A
  // read-then-check implementation (the old code) would have incorrectly
  // treated this as "fine to close" and silently overwritten the winner's
  // outcome/note/closer; the fix must still reject it.
  test('test_close_staleOpenReadButRaceLostAtUpdateTime_throwsBadRequestWithoutOverwriting', async () => {
    const incident = { id: 'incident-1', status: 'open' } as IntrusionIncidentEntity;
    const { service, incidentRepo } = buildService({ incident });
    incidentRepo.update = jest.fn().mockResolvedValue({ affected: 0 });

    await expect(service.close('incident-1', 'losing-closer', 'resolved', 'note')).rejects.toThrow(
      'This intrusion incident has already been closed',
    );
    expect(incidentRepo.update).toHaveBeenCalledWith({ id: 'incident-1', status: 'open' }, expect.anything());
  });

  test('test_close_incidentNotFound_throwsNotFound', async () => {
    const { service } = buildService({ incident: null });

    await expect(service.close('missing', 'person-closer', 'false_positive', 'note')).rejects.toThrow(
      'intrusion_incident missing not found',
    );
  });
});
