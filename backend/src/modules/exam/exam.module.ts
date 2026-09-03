import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { ExamAccessService } from './exam-access.service';
import { ExamAnswerService } from './exam-answer.service';
import { ExamAuditService } from './exam-audit.service';
import { ExamAuthoringService } from './exam-authoring.service';
import { ExamAvailabilityService } from './exam-availability.service';
import { ExamController } from './exam.controller';
import { ExamEventThrottlerGuard } from './exam-event-throttler.guard';
import { ExamGradingService } from './exam-grading.service';
import { ExamMonitoringService } from './exam-monitoring.service';
import { ExamPanelService } from './exam-panel.service';
import { ExamRlsContextService } from './exam-rls-context.service';
import { ExamSessionService } from './exam-session.service';
import { ExamStudentController } from './exam-student.controller';
import { ExamStudentScopeInterceptor } from './exam-student-scope.interceptor';
import { ExamStudentService } from './exam-student.service';
import { ExamTimerService } from './exam-timer.service';
import { ExamViolationPolicyService } from './exam-violation-policy.service';

// Área de Provas (Frente 04) — a synchronous bounded context, with no queue
// and no events, unlike the attendance/intrusion pipelines: the edge here is
// an authenticated browser, not an unreliable IoT device (approved
// architecture, 2026-09-02).
//
// The six components the approved architecture names map one-to-one onto
// services here — Availability, Timer, Monitoring, ViolationPolicy, Session
// and Audit — and everything else in this module exists to serve them:
// ExamAccess (the single RULE-EXAM-16 authorization path),
// ExamRlsContext/ExamStudentScopeInterceptor (the migration's RLS contract),
// Authoring/Answer/Grading (the write paths that are not session state), and
// Student/Panel (the two read models, kept apart because only one of them
// may ever see the answer key — RULE-EXAM-17).
//
// LeadershipScopeModule is imported rather than reimplemented: no new
// authorization check exists in this module.
@Module({
  imports: [AuthModule, LeadershipScopeModule],
  controllers: [ExamController, ExamStudentController],
  providers: [
    ExamRlsContextService,
    ExamStudentScopeInterceptor,
    ExamEventThrottlerGuard,
    ExamAccessService,
    ExamAvailabilityService,
    ExamTimerService,
    ExamViolationPolicyService,
    ExamAuditService,
    ExamGradingService,
    ExamSessionService,
    ExamMonitoringService,
    ExamAnswerService,
    ExamAuthoringService,
    ExamPanelService,
    ExamStudentService,
  ],
})
export class ExamModule {}
