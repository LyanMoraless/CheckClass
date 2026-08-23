import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AreaEntity, RawSecurityEventEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { DetectIntrusionJobData, DETECT_INTRUSION_QUEUE } from '../intrusion-detection/detect-intrusion.job';
import { QueueService } from '../../queue/queue.service';
import { SecurityIngestionEventEnvelopeDto } from './dto/security-ingestion-event-envelope.dto';
import { validateSecurityEventData } from './security-event-data.validator';

export interface SecurityIngestionResult {
  created: boolean;
  eventId: string;
}

// "Gateway de Ingestão de Sinais de Segurança" (architecture-overview.md):
// sibling of IngestionService, same shape/idempotency/transactional-outbox
// pattern, but writes to raw_security_event (never raw_identification_event)
// and enqueues onto its own queue for the Motor de Detecção de Intrusão.
// Never decides anything about intrusion itself — that's the worker's job.
@Injectable()
export class SecurityIngestionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly queue: QueueService,
  ) {}

  async ingest(deviceId: string, envelope: SecurityIngestionEventEnvelopeDto): Promise<SecurityIngestionResult> {
    validateSecurityEventData(envelope.eventType, envelope.data);

    const tenantId = this.tenantContext.getTenantId();
    const manager = this.tenantContext.getManager();

    // raw_security_event.area_id's FK is a plain REFERENCES area(id), with
    // no tenant pairing — and FK constraint checks run with elevated
    // privilege that bypasses RLS row-visibility. Without this explicit,
    // tenant-scoped lookup (same pattern as CameraService.create), a device
    // from tenant A could reference an areaId belonging to tenant B and the
    // insert would still succeed, corrupting tenant A's own security data.
    const area = await manager.getRepository(AreaEntity).findOneBy({ id: envelope.areaId });
    if (!area) {
      throw new NotFoundException(`area ${envelope.areaId} not found`);
    }

    // TypeORM's QueryDeepPartialEntity can't type-check a jsonb column's
    // plain object value without misreading it as a nested relation shape —
    // same known limitation noted in IngestionService, not a real
    // type-safety gap (the column is jsonb).
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(RawSecurityEventEntity)
      .values({
        tenantId,
        deviceId,
        eventType: envelope.eventType,
        areaId: envelope.areaId,
        capturedAt: new Date(envelope.capturedAt),
        idempotencyKey: envelope.idempotencyKey,
        rawPayload: envelope.data,
      } as QueryDeepPartialEntity<RawSecurityEventEntity>)
      .orIgnore()
      .returning(['id'])
      .execute();

    // With .orIgnore(), a conflicting insert still leaves one (empty) entry in
    // identifiers — no id inside it — rather than shrinking the array, so the
    // id's presence is what actually distinguishes "inserted" from "ignored"
    // (same idiom as IngestionService).
    const insertedId = insertResult.identifiers[0]?.id as string | undefined;
    if (insertedId) {
      // Enqueued on the SAME connection/transaction as the insert above
      // (transactional outbox), mirroring IngestionService's guarantee.
      const jobData: DetectIntrusionJobData = { rawEventId: insertedId, tenantId };
      await this.queue.sendWithManager(DETECT_INTRUSION_QUEUE, jobData, manager);
      return { created: true, eventId: insertedId };
    }

    // idempotency_key already existed for this tenant. Unlike
    // raw_identification_event's history, raw_security_event's uniqueness
    // constraint was scoped to (tenant_id, idempotency_key) from the start
    // (AddRawSecurityEvent migration), so this lookup can safely include
    // tenantId directly with no cross-tenant collision caveat.
    const existing = await manager.getRepository(RawSecurityEventEntity).findOneBy({
      tenantId,
      idempotencyKey: envelope.idempotencyKey,
    });
    if (!existing) {
      throw new InternalServerErrorException('idempotency_key conflict could not be resolved for this tenant');
    }
    return { created: false, eventId: existing.id };
  }
}
