import { Module } from '@nestjs/common';
import { AttendanceFrequencyModule } from '../attendance-frequency/attendance-frequency.module';
import { AuthModule } from '../auth/auth.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { PendingReviewController } from './pending-review.controller';
import { PendingReviewService } from './pending-review.service';

@Module({
  imports: [AuthModule, LeadershipScopeModule, AttendanceFrequencyModule],
  controllers: [PendingReviewController],
  providers: [PendingReviewService],
  exports: [PendingReviewService],
})
export class PendingReviewModule {}
