import { Module } from '@nestjs/common';
import { AreaAuthorizationModule } from '../area-authorization/area-authorization.module';
import { WristbandIdentityModule } from '../wristband-identity/wristband-identity.module';
import { IntrusionDetectionService } from './intrusion-detection.service';
import { IntrusionDetectionWorker } from './intrusion-detection.worker';

@Module({
  imports: [WristbandIdentityModule, AreaAuthorizationModule],
  providers: [IntrusionDetectionService, IntrusionDetectionWorker],
})
export class IntrusionDetectionModule {}
