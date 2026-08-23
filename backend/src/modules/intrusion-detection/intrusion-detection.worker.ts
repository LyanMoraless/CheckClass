import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { QueueService } from '../../queue/queue.service';
import { DetectIntrusionJobData, DETECT_INTRUSION_QUEUE } from './detect-intrusion.job';
import { IntrusionDetectionService } from './intrusion-detection.service';

// Bridges the queue to IntrusionDetectionService — same shape as
// IdentificationWorker/DeduplicationWorker: each job runs in its own
// tenant-scoped transaction, since a worker has no request/guard to have
// resolved that context for it.
@Injectable()
export class IntrusionDetectionWorker implements OnModuleInit {
  private readonly logger = new Logger(IntrusionDetectionWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly tenantContext: TenantContextService,
    private readonly intrusionDetectionService: IntrusionDetectionService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work<DetectIntrusionJobData>(DETECT_INTRUSION_QUEUE, async ({ rawEventId, tenantId }) => {
      await this.tenantContext.runWithTenant(tenantId, () => this.intrusionDetectionService.processRawEvent(rawEventId));
    });
    this.logger.log(`Listening on queue "${DETECT_INTRUSION_QUEUE}"`);
  }
}
