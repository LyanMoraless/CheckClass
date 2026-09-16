import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { GuardianLinkFollowupController } from './guardian-link-followup.controller';
import { GuardianLinkFollowupService } from './guardian-link-followup.service';

// Exports GuardianLinkFollowupService: PersonManagementModule imports this
// module both for its own controller's PATCH .../guardian-link-followups/:id
// closure endpoint and for RetroactiveMinorConsentGuardService's open() call.
@Module({
  imports: [AuthModule],
  controllers: [GuardianLinkFollowupController],
  providers: [GuardianLinkFollowupService],
  exports: [GuardianLinkFollowupService],
})
export class GuardianLinkFollowupModule {}
