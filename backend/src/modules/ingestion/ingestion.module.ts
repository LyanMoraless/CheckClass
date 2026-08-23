import { Module } from '@nestjs/common';
import { DeviceAuthGuard } from './device-auth.guard';
import { DeviceAuthService } from './device-auth.service';
import { IngestionController } from './ingestion.controller';
import { IngestionService } from './ingestion.service';

@Module({
  controllers: [IngestionController],
  providers: [IngestionService, DeviceAuthService, DeviceAuthGuard],
  // DeviceAuthGuard/DeviceAuthService exported so the sibling Gateway de
  // Ingestão de Sinais de Segurança (security-ingestion module) can reuse the
  // exact same device-authentication mechanism as-is (ratified tech decision,
  // architecture-overview.md — "Segurança de Intrusão, primeira rodada",
  // item 2: one mechanism covers both device-ingestion gateways, not two
  // separate decisions).
  exports: [DeviceAuthGuard, DeviceAuthService],
})
export class IngestionModule {}
