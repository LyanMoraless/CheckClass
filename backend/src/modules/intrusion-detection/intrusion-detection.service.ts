import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { IntrusionIncidentEntity, IntrusionIncidentLocationEntryEntity, RawSecurityEventEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { AreaAuthorizationService } from '../area-authorization/area-authorization.service';
import { SecurityIngestionEventType } from '../security-ingestion/security-ingestion-event-type.enum';
import { WristbandIdentityService } from '../wristband-identity/wristband-identity.service';

const UNIQUE_VIOLATION = '23505';

interface CandidateEvaluation {
  isIntrusion: boolean;
  personId: string | null;
  wristbandCategoryId: string | null;
}

// "Motor de Detecção de Intrusão" (architecture-overview.md — Segurança de
// Intrusão, primeira rodada): concentrates "what counts as intrusion", the
// same spirit the Motor de Regras concentrates "what counts as presença".
// Runs off its own queue (see IntrusionDetectionWorker), never inline with
// the ingestion request. Never touches the attendance pipeline's tables/
// services (raw_identification_event, DeduplicationService,
// AttendanceRulesEngineService) — completely separate pipeline.
@Injectable()
export class IntrusionDetectionService {
  private readonly logger = new Logger(IntrusionDetectionService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly wristbandIdentity: WristbandIdentityService,
    private readonly areaAuthorization: AreaAuthorizationService,
  ) {}

  async processRawEvent(rawEventId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rawEvent = await manager.getRepository(RawSecurityEventEntity).findOneBy({ id: rawEventId });
    if (!rawEvent) {
      this.logger.warn(`Raw security event ${rawEventId} not found for tenant ${tenantId} — nothing to correlate`);
      return;
    }

    const candidate = await this.evaluateCandidate(rawEvent);
    if (!candidate.isIntrusion) {
      // Authorized presence (a resolved identity whose category has a valid
      // area/bloco/período permission for this area) — nothing to alert on.
      return;
    }

    await this.correlateIntoIncident(manager, tenantId, rawEvent, candidate);
  }

  // RULE-SEC-01's note defines "unauthorized" concretely:
  //   - IR_BARRIER_CROSSING is always a candidate signal — anonymous by
  //     nature (a beam trip carries no identity), so it's always treated as
  //     unexplained presence (the rule's "no wristband = unauthorized"
  //     default).
  //   - AREA_READER_SCAN: an unresolved tag (unknown OR deactivated
  //     wristband) is unauthorized by the same default. A resolved tag is
  //     checked against the Serviço de Autorização de Área for this area at
  //     the signal's captured_at; authorized -> not a candidate, otherwise a
  //     candidate carrying the resolved identity.
  private async evaluateCandidate(rawEvent: RawSecurityEventEntity): Promise<CandidateEvaluation> {
    if (rawEvent.eventType === SecurityIngestionEventType.IR_BARRIER_CROSSING) {
      return { isIntrusion: true, personId: null, wristbandCategoryId: null };
    }

    const tagCode = (rawEvent.rawPayload as Record<string, unknown>).tagCode as string | undefined;
    const identity = tagCode ? await this.wristbandIdentity.resolveByTagCode(tagCode) : null;
    if (!identity) {
      return { isIntrusion: true, personId: null, wristbandCategoryId: null };
    }

    const authorized = await this.areaAuthorization.isAuthorized(
      identity.wristbandCategoryId,
      rawEvent.areaId,
      rawEvent.capturedAt,
    );
    return {
      isIntrusion: !authorized,
      personId: identity.personId,
      wristbandCategoryId: identity.wristbandCategoryId,
    };
  }

  // RULE-SEC-01's confirmed "index case" behavior: while an incident is
  // open, a new correlated signal updates that SAME incident (appends a
  // location-history entry, updates current_area_id) instead of opening a
  // second one. The DB's partial unique index (one open incident per tenant)
  // enforces this even under concurrent workers — a lost race on INSERT is
  // treated the same as finding the open incident up front.
  private async correlateIntoIncident(
    manager: EntityManager,
    tenantId: string,
    rawEvent: RawSecurityEventEntity,
    candidate: CandidateEvaluation,
  ): Promise<void> {
    const incidentRepository = manager.getRepository(IntrusionIncidentEntity);
    const openIncident = await incidentRepository.findOneBy({ status: 'open' });

    const incidentId = openIncident
      ? await this.appendToOpenIncident(incidentRepository, openIncident.id, rawEvent.areaId)
      : await this.openNewIncident(manager, tenantId, rawEvent.areaId, candidate);

    const locationRepository = manager.getRepository(IntrusionIncidentLocationEntryEntity);
    await locationRepository.save(
      locationRepository.create({
        tenantId,
        intrusionIncidentId: incidentId,
        rawSecurityEventId: rawEvent.id,
        areaId: rawEvent.areaId,
        detectedAt: rawEvent.capturedAt,
      }),
    );
  }

  private async appendToOpenIncident(
    incidentRepository: Repository<IntrusionIncidentEntity>,
    incidentId: string,
    areaId: string,
  ): Promise<string> {
    await incidentRepository.update({ id: incidentId }, { currentAreaId: areaId });
    return incidentId;
  }

  // The whole processRawEvent job runs inside ONE Postgres transaction
  // (TenantContextService.runWithTenant), a single BEGIN...COMMIT with no
  // savepoints of its own. Without the SAVEPOINT this method wraps around
  // the speculative insert, a lost race here (23505 on the partial unique
  // index) would mark the ENTIRE surrounding transaction as aborted —
  // Postgres rejects every subsequent statement on it with 25P02, including
  // the fallback lookup below, which would then blow up the whole job
  // instead of correlating into the winning incident. manager.transaction()
  // on a manager that's already bound to an open transaction's queryRunner
  // (which the manager passed into correlateIntoIncident always is, since it
  // comes straight from runWithTenant's dataSource.transaction callback)
  // issues SAVEPOINT/RELEASE SAVEPOINT/ROLLBACK TO SAVEPOINT instead of a
  // fresh BEGIN/COMMIT/ROLLBACK (see TypeORM's EntityManager.transaction +
  // PostgresQueryRunner.startTransaction) — so only this speculative insert
  // is undone on conflict, and the outer transaction (and the fallback
  // lookup that runs on it right after) stays perfectly valid.
  private async openNewIncident(
    manager: EntityManager,
    tenantId: string,
    areaId: string,
    candidate: CandidateEvaluation,
  ): Promise<string> {
    try {
      const created = await manager.transaction(async (savepointManager) => {
        const repository = savepointManager.getRepository(IntrusionIncidentEntity);
        return repository.save(
          repository.create({
            tenantId,
            personId: candidate.personId,
            wristbandCategoryId: candidate.wristbandCategoryId,
            currentAreaId: areaId,
            status: 'open',
          }),
        );
      });
      return created.id;
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        // Lost the race to open a new incident — another worker committed
        // one concurrently for this tenant. The SAVEPOINT rollback above
        // means the outer transaction is still valid, so this fallback
        // lookup runs cleanly on it. Correlate into the race winner instead,
        // exactly the "index case" behavior this method would have taken had
        // it observed the open incident a moment earlier.
        const raceWinner = await manager.getRepository(IntrusionIncidentEntity).findOneByOrFail({ status: 'open' });
        return raceWinner.id;
      }
      throw error;
    }
  }
}
