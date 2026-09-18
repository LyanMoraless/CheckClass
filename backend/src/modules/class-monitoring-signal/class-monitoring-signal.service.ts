import { Injectable, InternalServerErrorException, UnprocessableEntityException } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { RawLocationSignalEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ReportClassMonitoringSignalDto } from './dto/report-class-monitoring-signal.dto';

export interface ReportClassMonitoringSignalResult {
  created: boolean;
  signalId: string;
}

// signal_type value LocationVerificationService.evaluateDepartureFromClassLocation
// already reads (RULE-PRES-09) — see raw-location-signal.entity.ts's own
// comment on the closed vocabulary.
const CLASS_MONITORING_SIGNAL_TYPE = 'class_monitoring';

// Closes the gap the Mobile Agent flagged (architecture-overview.md's
// "Implementação — App Mobile", item 4): the first and only writer of
// raw_location_signal (signal_type = 'class_monitoring') — the reader
// (LocationVerificationService) already existed and already worked against
// this exact shape (RULE-PRES-09).
//
// Structurally the closest sibling to AppCheckinService — same person-JWT-
// authenticated family, same server-clock discipline (RULE-PRES-02), same
// client-generated idempotencyKey / insert-or-ignore resend tolerance — but
// deliberately its own module: this table has no downstream queue/pipeline
// job to enqueue (raw_location_signal is a leaf table, read directly by
// LocationVerificationService, not fed through Identification/Deduplication
// like raw_identification_event), so there's nothing here to mirror from
// AppCheckinService beyond the shape of the write itself.
@Injectable()
export class ClassMonitoringSignalService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async report(personId: string, dto: ReportClassMonitoringSignalDto): Promise<ReportClassMonitoringSignalResult> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // The server's own request-received timestamp (RULE-PRES-02) — never
    // derived from anything in `dto` (there is no capturedAt field on it at
    // all, see that DTO's own comment). Used both for the in-progress check
    // below and as raw_location_signal.captured_at.
    const serverReceivedAt = new Date();

    // Decision made by this agent (flagged in the Backend Implementation
    // Summary, not presumed to be the only reading of RULE-PRES-09): reuses
    // the EXACT same enrollment + "in progress right now" resolution query
    // AppCheckinService.resolveActiveClassSession already runs (RULE-ATT-06's
    // confirmed note), here scoped to the caller-supplied classSessionId
    // instead of auto-discovering it — the app already knows which
    // in-progress session it's monitoring (GET /v1/me/schedule, see
    // use-class-monitoring.ts), but the server still re-validates it rather
    // than trusting the client's own belief that a session is live and
    // theirs.
    //
    // Rejecting (422) when this doesn't resolve — rather than RULE-PRES-01's
    // "login funciona normalmente, evento não entra no pipeline" tolerant
    // pattern — mirrors AppCheckinService's OWN "no active session" 422, not
    // that gate: RULE-PRES-01's tolerance exists because a larger action
    // (login itself) must keep succeeding regardless of the gate's outcome.
    // There is no such larger action here — a class_monitoring reading IS
    // the whole request, so when it has nowhere valid to attach to there is
    // nothing to silently succeed at.
    const rows: Array<{ id: string }> = await manager.query(
      `
      SELECT cs.id
      FROM class_group_enrollment cge
      JOIN class_session cs ON cs.class_group_id = cge.class_group_id
      WHERE cge.tenant_id = $1
        AND cge.person_id = $2
        AND cs.id = $3
        AND cs.scheduled_start <= $4::timestamptz
        AND cs.scheduled_end >= $4::timestamptz
      `,
      [tenantId, personId, dto.classSessionId, serverReceivedAt.toISOString()],
    );
    if (rows.length === 0) {
      throw new UnprocessableEntityException(
        'This class session is not currently in progress for one of your enrolled classes; the reading was rejected.',
      );
    }

    // Same transactional insert-or-ignore pattern as AppCheckinService.submit
    // / IngestionService.ingest: raw_location_signal.idempotency_key's own
    // UNIQUE(tenant_id, idempotency_key) constraint (AddRawLocationSignal
    // migration, tenant-scoped from creation — no later correction needed,
    // unlike raw_identification_event's) makes a resent reading idempotent
    // for free.
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(RawLocationSignalEntity)
      .values({
        tenantId,
        signalType: CLASS_MONITORING_SIGNAL_TYPE,
        classSessionId: dto.classSessionId,
        rawIdentificationEventId: null,
        personId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters,
        isMocked: dto.isMocked,
        capturedAt: serverReceivedAt,
        idempotencyKey: dto.idempotencyKey,
      } as QueryDeepPartialEntity<RawLocationSignalEntity>)
      .orIgnore()
      .returning(['id'])
      .execute();

    const insertedId = insertResult.identifiers[0]?.id as string | undefined;
    if (insertedId) {
      return { created: true, signalId: insertedId };
    }

    // idempotency_key already existed for this tenant — same resend-tolerance
    // semantics as AppCheckinService.submit, first-valid-submission wins.
    const existing = await manager.getRepository(RawLocationSignalEntity).findOneBy({ idempotencyKey: dto.idempotencyKey });
    if (!existing) {
      throw new InternalServerErrorException('idempotency_key conflict could not be resolved for this tenant');
    }
    return { created: false, signalId: existing.id };
  }
}
