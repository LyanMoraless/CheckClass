import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassMonitoringSignalController } from './class-monitoring-signal.controller';
import { ClassMonitoringSignalService } from './class-monitoring-signal.service';

// RULE-PRES-09 — the ingestion endpoint for raw_location_signal
// (signal_type = 'class_monitoring'), closing the gap flagged in
// architecture-overview.md's "Implementação — App Mobile" (item 4). Own
// module, same shape as AppCheckinModule: only AuthModule is needed
// (JwtAuthGuard's JwtService), no dependency on LocationVerificationModule/
// LocationConsentModule/RoomPresenceModule — this service only ever WRITES
// raw_location_signal, it never reads it or any of those other modules'
// state (mão única, same direction discipline already fixed for this
// feature: LocationVerificationService is the one and only reader).
@Module({
  imports: [AuthModule],
  controllers: [ClassMonitoringSignalController],
  providers: [ClassMonitoringSignalService],
})
export class ClassMonitoringSignalModule {}
