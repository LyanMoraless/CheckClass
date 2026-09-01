import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { PendingReviewController } from './pending-review.controller';
import { PendingReviewService } from './pending-review.service';

@Module({
  imports: [AuthModule, LeadershipScopeModule],
  controllers: [PendingReviewController],
  providers: [PendingReviewService],
  exports: [PendingReviewService],
})
export class PendingReviewModule {}
