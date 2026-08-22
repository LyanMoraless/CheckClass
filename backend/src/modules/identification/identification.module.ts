import { Module } from '@nestjs/common';
import { IdentificationService } from './identification.service';
import { IdentificationWorker } from './identification.worker';

@Module({
  providers: [IdentificationService, IdentificationWorker],
})
export class IdentificationModule {}
