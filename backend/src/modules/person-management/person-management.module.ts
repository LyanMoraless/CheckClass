import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonManagementController } from './person-management.controller';
import { PersonManagementService } from './person-management.service';
import { PersonMinorityStatusService } from './person-minority-status.service';
import { RetroactiveMinorConsentGuardService } from './retroactive-minor-consent-guard.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonManagementController],
  providers: [PersonManagementService, PersonMinorityStatusService, RetroactiveMinorConsentGuardService],
  // PersonMinorityStatusService is the reusable "é menor"/RULE-GRD-07 gate
  // RULE-FACE-09 and RULE-PRES-14 must import PersonManagementModule to
  // reuse, once those flows are implemented (see that service's header).
  exports: [PersonMinorityStatusService],
})
export class PersonManagementModule {}
