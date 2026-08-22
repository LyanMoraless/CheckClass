import { Module } from '@nestjs/common';
import { PendingReviewService } from './pending-review.service';

@Module({
  providers: [PendingReviewService],
  exports: [PendingReviewService],
})
export class PendingReviewModule {}
