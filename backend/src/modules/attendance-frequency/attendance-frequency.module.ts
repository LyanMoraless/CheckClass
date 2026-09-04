import { Module } from '@nestjs/common';
import { TenantConfigModule } from '../config/tenant-config.module';
import { AttendanceFrequencyEngineService } from './attendance-frequency-engine.service';
import { AttendanceWarningService } from './attendance-warning.service';
import { FrequencyWarningReadService } from './frequency-warning-read.service';

// Bounded context "attendance-frequency" (Controle B, Frente 06), parallel to
// attendance-rules/pending-review inside the same modular monolith.
//
// No controller: the student-facing surface of Frente 06 is a route in the
// existing /v1/me/* family (GET /v1/me/warnings), dispatched separately — this
// module has no HTTP surface of its own, which is also why it does not import
// AuthModule the way controller-carrying modules do.
//
// ALL THREE services are exported. The engine is what the recompute call
// sites use (PendingReviewService.resolve, the session-evaluate CLI, and
// Frente 07's justification approval when it arrives); AttendanceWarningService
// is exported for the two turma-deletion primitives in
// ClassGroupDeletionOrchestrator, which need to end warnings WITHOUT
// recalculating anything — the turma/matéria they would be recalculating is
// exactly what is being taken away; FrequencyWarningReadService is exported
// for SelfServiceModule, whose MeController owns the GET /v1/me/warnings route
// and delegates the whole read to it (same shape as
// MeClassGroupAttendanceService delegating to AttendanceRegisterService).
// SelfServiceModule imports THIS module rather than re-providing anything from
// it: a second instance of the engine would be a second decision-maker over
// the same rows.
@Module({
  imports: [TenantConfigModule],
  providers: [AttendanceFrequencyEngineService, AttendanceWarningService, FrequencyWarningReadService],
  exports: [AttendanceFrequencyEngineService, AttendanceWarningService, FrequencyWarningReadService],
})
export class AttendanceFrequencyModule {}
