import { Module } from '@nestjs/common';
import { DeduplicationService } from './deduplication.service';
import { DeduplicationWorker } from './deduplication.worker';

@Module({
  providers: [DeduplicationService, DeduplicationWorker],
})
export class DeduplicationModule {}
