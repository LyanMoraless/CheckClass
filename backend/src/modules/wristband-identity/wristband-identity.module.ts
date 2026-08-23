import { Module } from '@nestjs/common';
import { WristbandIdentityService } from './wristband-identity.service';

@Module({
  providers: [WristbandIdentityService],
  exports: [WristbandIdentityService],
})
export class WristbandIdentityModule {}
