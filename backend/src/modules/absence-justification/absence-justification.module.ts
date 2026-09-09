import { Module } from '@nestjs/common';
import { AttendanceFrequencyModule } from '../attendance-frequency/attendance-frequency.module';
import { AuthModule } from '../auth/auth.module';
import { TenantConfigModule } from '../config/tenant-config.module';
import { AbsenceJustificationAreaGateInterceptor } from './absence-justification-area-gate.interceptor';
import { AbsenceJustificationAreaGateService } from './absence-justification-area-gate.service';
import { AbsenceJustificationAttachmentStorageService } from './absence-justification-attachment-storage.service';
import { AbsenceJustificationAttachmentService } from './absence-justification-attachment.service';
import { AbsenceJustificationDecisionController } from './absence-justification-decision.controller';
import { AbsenceJustificationDecisionService } from './absence-justification-decision.service';
import { AbsenceJustificationEligibilityService } from './absence-justification-eligibility.service';
import { AbsenceJustificationNoticeController } from './absence-justification-notice.controller';
import { AbsenceJustificationNoticeReadService } from './absence-justification-notice-read.service';
import { AbsenceJustificationNoticeService } from './absence-justification-notice.service';
import { AbsenceJustificationPersonScopeInterceptor } from './absence-justification-person-scope.interceptor';
import { AbsenceJustificationRlsContextService } from './absence-justification-rls-context.service';
import { AbsenceJustificationSubmissionController } from './absence-justification-submission.controller';
import { AbsenceJustificationSubmissionService } from './absence-justification-submission.service';
import { TeacherSubjectScopeService } from './teacher-subject-scope.service';

// Frente 07 — Justificativa de Faltas. AttendanceFrequencyModule is
// imported, not re-provided: this module's decision service is the fourth
// call site of AttendanceFrequencyEngineService.recalculateForSessionPerson
// that module's own header comment already anticipated — a second instance
// of the engine would be a second decision-maker over the same rows (same
// reasoning SelfServiceModule's import already documents).
//
// No AbsenceJustificationRlsContextService.applyManagementScope() exists —
// Coordenação/Direção read surfaces (RULE-JUST-08's "veem a decisão, não o
// arquivo") are out of this round's explicit scope; see the Backend
// Implementation Summary.
@Module({
  imports: [AuthModule, TenantConfigModule, AttendanceFrequencyModule],
  controllers: [AbsenceJustificationSubmissionController, AbsenceJustificationDecisionController, AbsenceJustificationNoticeController],
  providers: [
    AbsenceJustificationRlsContextService,
    AbsenceJustificationAreaGateService,
    AbsenceJustificationAreaGateInterceptor,
    AbsenceJustificationPersonScopeInterceptor,
    TeacherSubjectScopeService,
    AbsenceJustificationEligibilityService,
    AbsenceJustificationAttachmentStorageService,
    AbsenceJustificationAttachmentService,
    AbsenceJustificationSubmissionService,
    AbsenceJustificationDecisionService,
    AbsenceJustificationNoticeService,
    AbsenceJustificationNoticeReadService,
  ],
  // Exported for the retention-sweep CLI script (RULE-JUST-19), which builds
  // its own application context via NestFactory.createApplicationContext
  // (same pattern as session-evaluate.ts) and needs both providers directly.
  exports: [AbsenceJustificationRlsContextService, AbsenceJustificationAttachmentService],
})
export class AbsenceJustificationModule {}
