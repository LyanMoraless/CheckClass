import { Module } from '@nestjs/common';
import { IngestionModule } from '../ingestion/ingestion.module';
import { SecurityIngestionController } from './security-ingestion.controller';
import { SecurityIngestionService } from './security-ingestion.service';

@Module({
  // Reuses DeviceAuthGuard/DeviceAuthService exported by IngestionModule —
  // the ratified device-auth mechanism, not a reimplementation.
  imports: [IngestionModule],
  controllers: [SecurityIngestionController],
  providers: [SecurityIngestionService],
  exports: [SecurityIngestionService],
})
export class SecurityIngestionModule {}
