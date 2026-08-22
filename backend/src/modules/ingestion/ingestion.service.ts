import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { TenantContextService } from '../../database/tenant-context.service';
import { RawIdentificationEventEntity } from '../../database/entities';
import { QueueService } from '../../queue/queue.service';
import { IdentifyEventJobData, IDENTIFY_EVENT_QUEUE } from '../identification/identify-event.job';
import { IngestionEventEnvelopeDto } from './dto/ingestion-event-envelope.dto';
import { validateEventData } from './event-data.validator';

export interface IngestionResult {
  created: boolean;
  eventId: string;
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly queue: QueueService,
  ) {}

  async ingest(deviceId: string, envelope: IngestionEventEnvelopeDto): Promise<IngestionResult> {
    validateEventData(envelope.eventType, envelope.data);

    const tenantId = this.tenantContext.getTenantId();
    const manager = this.tenantContext.getManager();

    const rawPayload: Record<string, unknown> = {
      capturedAt: envelope.capturedAt,
      roomId: envelope.roomId ?? null,
      data: envelope.data,
    };

    // TypeORM's QueryDeepPartialEntity can't type-check a jsonb column's
    // plain object value without misreading it as a nested relation shape —
    // a known limitation, not a real type-safety gap (the column is jsonb).
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(RawIdentificationEventEntity)
      .values({
        tenantId,
        deviceId,
        eventType: envelope.eventType,
        idempotencyKey: envelope.idempotencyKey,
        rawPayload,
      } as QueryDeepPartialEntity<RawIdentificationEventEntity>)
      .orIgnore()
      .returning(['id'])
      .execute();

    // With .orIgnore(), a conflicting insert still leaves one (empty) entry in
    // identifiers — no id inside it — rather than shrinking the array, so the
    // id's presence is what actually distinguishes "inserted" from "ignored".
    const insertedId = insertResult.identifiers[0]?.id as string | undefined;
    if (insertedId) {
      // Enqueued on the SAME connection/transaction as the insert above
      // (transactional outbox): the job only becomes durable if this
      // transaction commits, so a crash right after insert can't lose it,
      // and a rollback can't leave an orphaned job for a row that never existed.
      const jobData: IdentifyEventJobData = { rawEventId: insertedId, tenantId };
      await this.queue.sendWithManager(IDENTIFY_EVENT_QUEUE, jobData, manager);
      return { created: true, eventId: insertedId };
    }

    // idempotency_key already existed (RULE-ATT-10, first valid event wins).
    const existing = await manager.getRepository(RawIdentificationEventEntity).findOneBy({
      idempotencyKey: envelope.idempotencyKey,
    });
    if (!existing) {
      // Extremely unlikely: idempotency_key is unique across ALL tenants, not
      // just this one, so a collision with another tenant's key is hidden by
      // RLS here even though it blocked our insert. Surfacing as 500 rather
      // than silently pretending success.
      throw new InternalServerErrorException('idempotency_key conflict could not be resolved for this tenant');
    }
    return { created: false, eventId: existing.id };
  }
}
