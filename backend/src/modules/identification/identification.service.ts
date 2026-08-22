import { Injectable, Logger } from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import {
  AttendanceFactorTypeEntity,
  ClassSessionEntity,
  IdentificationCheckinEntity,
  PersonFacialReferenceEntity,
  RawIdentificationEventEntity,
  WristbandEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { QueueService } from '../../queue/queue.service';
import { DeduplicateCheckinJobData, DEDUPLICATE_CHECKIN_QUEUE } from '../deduplication/deduplicate-checkin.job';
import { IngestionEventType } from '../ingestion/dto/ingestion-event-type.enum';

interface RawEventPayload {
  capturedAt: string;
  roomId: string | null;
  data: Record<string, unknown>;
}

// "Serviço de Identificação/Correlação de Pessoa" (architecture-overview.md):
// translates a raw device signal into a person identity within the right
// tenant (RULE-ACC-01/05). Runs off the queue (see IdentificationWorker),
// never inline with the ingestion request — the Gateway never blocks on
// business decisions. Deduplication (RULE-ATT-10) is a separate, later
// stage; an unresolved person/factor here is logged and dropped rather than
// retried, since retrying won't fix "this tag/face isn't registered".
@Injectable()
export class IdentificationService {
  private readonly logger = new Logger(IdentificationService.name);

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly queue: QueueService,
  ) {}

  async processRawEvent(rawEventId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rawEvent = await manager.getRepository(RawIdentificationEventEntity).findOneBy({ id: rawEventId });
    if (!rawEvent) {
      this.logger.warn(`Raw event ${rawEventId} not found for tenant ${tenantId} — nothing to correlate`);
      return;
    }

    // Aggregate signal (room occupancy count), not tied to one person.
    if (rawEvent.eventType === IngestionEventType.CAMERA_COUNT) {
      return;
    }

    const payload = rawEvent.rawPayload as unknown as RawEventPayload;

    const factorTypeId = await this.resolveFactorType(manager, rawEvent.eventType, payload.data);
    if (!factorTypeId) {
      this.logger.warn(`Unresolved attendance_factor_type for raw event ${rawEventId} (${rawEvent.eventType})`);
      return;
    }

    const personId = await this.resolvePerson(manager, rawEvent, payload.data);
    if (!personId) {
      this.logger.warn(`Unresolved person for raw event ${rawEventId} (${rawEvent.eventType})`);
      return;
    }

    const classSessionId = payload.roomId
      ? await this.resolveClassSession(manager, payload.roomId, payload.capturedAt)
      : null;

    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(IdentificationCheckinEntity)
      .values({
        tenantId,
        rawIdentificationEventId: rawEventId,
        personId,
        classSessionId,
        attendanceFactorTypeId: factorTypeId,
        checkinAt: new Date(payload.capturedAt),
      })
      // Idempotent against pg-boss's at-least-once delivery: a raw event
      // already correlated once is a no-op on retry (unique constraint from
      // the AddPersonFacialReference migration).
      .orIgnore()
      .returning(['id'])
      .execute();

    const checkinId = insertResult.identifiers[0]?.id as string | undefined;
    if (checkinId) {
      const jobData: DeduplicateCheckinJobData = { checkinId, tenantId };
      await this.queue.sendWithManager(DEDUPLICATE_CHECKIN_QUEUE, jobData, manager);
    }
  }

  private async resolveFactorType(
    manager: EntityManager,
    eventType: string,
    data: Record<string, unknown>,
  ): Promise<string | null> {
    if (eventType === IngestionEventType.CUSTOM) {
      const factorCode = data.factorCode as string;
      const factor = await manager.getRepository(AttendanceFactorTypeEntity).findOneBy({ code: factorCode });
      return factor?.id ?? null;
    }

    // Standard factor codes match IngestionEventType 1:1 (seeded, tenant_id
    // NULL) — restricting to NULL avoids an unlikely code collision with a
    // tenant's own custom factor.
    const factor = await manager
      .getRepository(AttendanceFactorTypeEntity)
      .findOneBy({ code: eventType, tenantId: IsNull() });
    return factor?.id ?? null;
  }

  private async resolvePerson(
    manager: EntityManager,
    rawEvent: RawIdentificationEventEntity,
    data: Record<string, unknown>,
  ): Promise<string | null> {
    if (rawEvent.eventType === IngestionEventType.FACIAL_CHECKIN) {
      const reference = await manager.getRepository(PersonFacialReferenceEntity).findOneBy({
        deviceId: rawEvent.deviceId,
        localReference: data.matchReference as string,
      });
      return reference?.personId ?? null;
    }

    const tagCode = data.tagCode as string | undefined;
    if (!tagCode) {
      return null;
    }
    // Code review finding: a deactivated/revoked wristband must not still
    // authenticate — status exists precisely for lost/stolen/reissued tags
    // (RULE-ACC-01's "identidade do usuário" is meant to be the CURRENT
    // holder, not whoever last held that physical tag).
    const wristband = await manager.getRepository(WristbandEntity).findOneBy({ tagCode, status: 'active' });
    return wristband?.personId ?? null;
  }

  private async resolveClassSession(manager: EntityManager, roomId: string, capturedAt: string): Promise<string | null> {
    const capturedDate = new Date(capturedAt);
    const session = await manager
      .getRepository(ClassSessionEntity)
      .createQueryBuilder('session')
      .where('session.roomId = :roomId', { roomId })
      .andWhere('session.scheduledStart <= :capturedAt', { capturedAt: capturedDate })
      .andWhere('session.scheduledEnd >= :capturedAt', { capturedAt: capturedDate })
      .getOne();
    return session?.id ?? null;
  }
}
