import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportMonitoringEventDto } from './dto/report-monitoring-event.dto';
import { SaveAnswerDto } from './dto/save-answer.dto';
import { ExamAnswerService } from './exam-answer.service';
import { ExamEventThrottlerGuard } from './exam-event-throttler.guard';
import { ExamMonitoringService } from './exam-monitoring.service';
import { ExamStudentScopeInterceptor } from './exam-student-scope.interceptor';
import { ExamStudentService } from './exam-student.service';

// A burst of blur/visibility events is normal (alt-tabbing rapidly), so this
// is a ceiling against saturation of the audit trail, not a normal-use limit.
const EVENT_REPORT_LIMIT = 60;
const EVENT_REPORT_TTL_MS = 60_000;

// Student side of the Exam Area, under /v1/me like every other self-scoped
// route family in this codebase (RULE-ATT-15's precedent): "my exams", "my
// session", "my answers".
//
// Security control 1 is structural here rather than a check that could be
// forgotten: NO route takes a personId or a sessionId. The person comes from
// request.personId (set by JwtAuthGuard from the verified JWT) and the
// session is always resolved as (that person, this exam) — there is simply
// no identifier in the URL that could name someone else's session.
//
// Interceptor order matters: TenantContextInterceptor opens the RLS
// transaction, and ExamStudentScopeInterceptor then sets app.person_id
// inside it, without which the ownership policies match zero rows (see the
// AddExamArea migration's contract).
@Controller('v1/me/exams')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, ExamStudentScopeInterceptor)
export class ExamStudentController {
  constructor(
    private readonly students: ExamStudentService,
    private readonly answers: ExamAnswerService,
    private readonly monitoring: ExamMonitoringService,
  ) {}

  // Published exams of the turmas where the student holds an ACTIVE
  // enrollment, each with its RULE-EXAM-06 window state and the student's own
  // session state. DRAFT exams are not here at all.
  @Get()
  listMyExams(@Req() request: AuthenticatedRequest) {
    return this.students.listMyExams(request.personId);
  }

  // Start, or recover after a reload — one endpoint, because which of the
  // two it is depends on state, not on what the client claims. RULE-EXAM-11:
  // a recovered session carries the SAME absolute expiresAt as the original.
  @Post(':examId/session')
  startSession(@Param('examId', ParseUUIDPipe) examId: string, @Req() request: AuthenticatedRequest) {
    return this.students.startSession(request.personId, examId);
  }

  // Pure read of an already-started session (with questions and the answers
  // saved so far) — never creates one, so refreshing the page can never
  // consume the single attempt.
  @Get(':examId/session')
  getMySession(@Param('examId', ParseUUIDPipe) examId: string, @Req() request: AuthenticatedRequest) {
    return this.students.getMySession(request.personId, examId);
  }

  // Incremental autosave of one question. Idempotent by (session, question),
  // which is what the UNIQUE constraint on exam_answer is for.
  @Put(':examId/answers/:questionId')
  saveAnswer(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() body: SaveAnswerDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.answers.saveAnswer(request.personId, examId, questionId, body);
  }

  // Browser-observed monitoring occurrence (RULE-EXAM-05/11). Throttled per
  // exam session rather than per IP — see ExamEventThrottlerGuard for why the
  // tracker is (tenant, exam, person).
  @Post(':examId/events')
  @UseGuards(ExamEventThrottlerGuard)
  @Throttle({ default: { limit: EVENT_REPORT_LIMIT, ttl: EVENT_REPORT_TTL_MS } })
  reportEvent(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() body: ReportMonitoringEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.monitoring.report(request.personId, examId, body);
  }

  // Manual submission. Never blocked by unanswered questions (confirmed
  // 2026-09-03) — automatic submission on expiry is handled server-side by
  // ExamSessionService and needs no client call at all.
  @Post(':examId/submit')
  submit(@Param('examId', ParseUUIDPipe) examId: string, @Req() request: AuthenticatedRequest) {
    return this.students.finish(request.personId, examId);
  }
}
