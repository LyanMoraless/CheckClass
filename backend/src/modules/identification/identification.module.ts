import { Module } from '@nestjs/common';
import { WristbandIdentityModule } from '../wristband-identity/wristband-identity.module';
import { IdentificationService } from './identification.service';
import { IdentificationWorker } from './identification.worker';

@Module({
  imports: [WristbandIdentityModule],
  providers: [IdentificationService, IdentificationWorker],
})
export class IdentificationModule {}
