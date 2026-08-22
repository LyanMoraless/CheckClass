import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { QueueService } from '../../queue/queue.service';
import { IdentifyEventJobData, IDENTIFY_EVENT_QUEUE } from './identify-event.job';
import { IdentificationService } from './identification.service';

// Bridges the queue to IdentificationService: each job runs in its own
// tenant-scoped transaction (same primitive the HTTP path uses via
// TenantContextInterceptor), since a worker has no request/guard to have
// resolved that context for it.
@Injectable()
export class IdentificationWorker implements OnModuleInit {
  private readonly logger = new Logger(IdentificationWorker.name);

  constructor(
    private readonly queue: QueueService,
    private readonly tenantContext: TenantContextService,
    private readonly identificationService: IdentificationService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.work<IdentifyEventJobData>(IDENTIFY_EVENT_QUEUE, async ({ rawEventId, tenantId }) => {
      await this.tenantContext.runWithTenant(tenantId, () => this.identificationService.processRawEvent(rawEventId));
    });
    this.logger.log(`Listening on queue "${IDENTIFY_EVENT_QUEUE}"`);
  }
}
