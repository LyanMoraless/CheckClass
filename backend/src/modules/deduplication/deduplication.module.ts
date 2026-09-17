import { Module } from '@nestjs/common';
import { RoomPresenceModule } from '../room-presence/room-presence.module';
import { DeduplicationService } from './deduplication.service';
import { DeduplicationWorker } from './deduplication.worker';

// Imports RoomPresenceModule (mão única: DeduplicationWorker consumes
// RoomPresenceService.recordFromCheckin right after deduplication resolves,
// room-presence never imports back) — see DeduplicationWorker's own comment
// for why this is where "pós-dedup" is wired, not a second queue.
@Module({
  imports: [RoomPresenceModule],
  providers: [DeduplicationService, DeduplicationWorker],
})
export class DeduplicationModule {}
