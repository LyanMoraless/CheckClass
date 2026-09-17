import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { QueueService } from '../../queue/queue.service';
import { RoomPresenceService } from '../room-presence/room-presence.service';
import { DeduplicateCheckinJobData, DEDUPLICATE_CHECKIN_QUEUE } from './deduplicate-checkin.job';
import { DeduplicationService } from './deduplication.service';

// room-presence's write path (RULE-PRES-04/07) is wired here, right after
// DeduplicationService.deduplicate() resolves this checkin's final
// is_duplicate state, inside the SAME tenant transaction
// (TenantContextService.runWithTenant wraps the whole callback in one DB
// transaction — see that service's own comment). "Pós-dedup" (architecture-
// overview.md, Bloco 2/3) cashes out concretely to "re-read the checkin's
// row AFTER deduplicate() already ran" — no second queue/consumer, and
// RoomPresenceService.recordFromCheckin's own re-fetch of the checkin
// correctly observes whichever is_duplicate value this same call just set.
@Injectable()
export class DeduplicationWorker implements OnModuleInit {
  private readonly logger = new Logger(DeduplicationWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly tenantContext: TenantContextService,
    private readonly deduplicationService: DeduplicationService,
    private readonly roomPresenceService: RoomPresenceService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work<DeduplicateCheckinJobData>(DEDUPLICATE_CHECKIN_QUEUE, async ({ checkinId, tenantId }) => {
      await this.tenantContext.runWithTenant(tenantId, async () => {
        await this.deduplicationService.deduplicate(checkinId);
        await this.roomPresenceService.recordFromCheckin(checkinId);
      });
    });
    this.logger.log(`Listening on queue "${DEDUPLICATE_CHECKIN_QUEUE}"`);
  }
}
