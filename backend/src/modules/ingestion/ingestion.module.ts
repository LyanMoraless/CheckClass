import { Module } from '@nestjs/common';
import { DeviceAuthGuard } from './device-auth.guard';
import { DeviceAuthService } from './device-auth.service';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  controllers: [IngestionController],
  providers: [IngestionService, DeviceAuthService, DeviceAuthGuard],
})
export class IngestionModule {}
