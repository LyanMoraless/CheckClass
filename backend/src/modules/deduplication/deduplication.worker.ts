import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { QueueService } from '../../queue/queue.service';
import { DeduplicateCheckinJobData, DEDUPLICATE_CHECKIN_QUEUE } from './deduplicate-checkin.job';
import { DeduplicationService } from './deduplication.service';

@Injectable()
export class DeduplicationWorker implements OnModuleInit {
  private readonly logger = new Logger(DeduplicationWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly tenantContext: TenantContextService,
    private readonly deduplicationService: DeduplicationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work<DeduplicateCheckinJobData>(DEDUPLICATE_CHECKIN_QUEUE, async ({ checkinId, tenantId }) => {
      await this.tenantContext.runWithTenant(tenantId, () => this.deduplicationService.deduplicate(checkinId));
    });
    this.logger.log(`Listening on queue "${DEDUPLICATE_CHECKIN_QUEUE}"`);
  }
}
