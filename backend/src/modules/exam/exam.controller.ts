import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateExamDto } from './dto/create-exam.dto';
import { CreateOptionDto } from './dto/create-option.dto';
import { CreateQuestionDto } from './dto/create-question.dto';
import { GradeAnswerDto } from './dto/grade-answer.dto';
import { UpdateExamDto } from './dto/update-exam.dto';
import { UpdateMonitoringConfigDto } from './dto/update-monitoring-config.dto';
import { UpdateOptionDto } from './dto/update-option.dto';
import { UpdateQuestionDto } from './dto/update-question.dto';
import { ExamAuthoringService } from './exam-authoring.service';
import { ExamGradingService } from './exam-grading.service';
import { ExamPanelService } from './exam-panel.service';

// Teacher/coordinator/direction side of the Exam Area: authoring, publishing,
// the live panel and manual grading.
//
// Guard shape is JwtAuthGuard + TenantContextInterceptor only — deliberately
// NO PermissionCheckInterceptor/@RequirePermission, the same reasoning
// MeController already applies to leadership-scoped reads: RULE-EXAM-16
// scopes this to the turmas a person actually leads, which is not a
// permission-group grant over "anyone's" data. A Professor holds no
// MANAGE_INSTITUTION_STRUCTURE and must still be able to author their own
// turma's exam, so adding a permission gate here would break the rule rather
// than reinforce it.
//
// Every method delegates the authorization to the service layer's single
// ExamAccessService path (which wraps LeadershipScopeService and only then
// opens the RLS management scope), and personId always comes from the
// verified JWT — never from a parameter.
@Controller('v1/exams')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class ExamController {
  constructor(
    private readonly authoring: ExamAuthoringService,
    private readonly panel: ExamPanelService,
    private readonly grading: ExamGradingService,
  ) {}

  @Post()
  create(@Body() body: CreateExamDto, @Req() request: AuthenticatedRequest) {
    return this.authoring.create(request.personId, body);
  }

  @Get()
  list(@Query('classGroupId', ParseUUIDPipe) classGroupId: string, @Req() request: AuthenticatedRequest) {
    return this.authoring.listByClassGroup(request.personId, classGroupId);
  }

  // Full authored exam, answer key included — RULE-EXAM-17 restricts what
  // the STUDENT is served, not the teacher.
  @Get(':examId')
  detail(@Param('examId', ParseUUIDPipe) examId: string, @Req() request: AuthenticatedRequest) {
    return this.panel.examDetail(request.personId, examId);
  }

  @Patch(':examId')
  update(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() body: UpdateExamDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authoring.update(request.personId, examId, body);
  }

  @Delete(':examId')
  async remove(@Param('examId', ParseUUIDPipe) examId: string, @Req() request: AuthenticatedRequest) {
    await this.authoring.remove(request.personId, examId);
    return { examId };
  }

  // The one act that makes an exam visible to students (confirmed
  // 2026-09-03) — its own endpoint precisely because opening the
  // availability window must NOT have that effect.
  @Post(':examId/publish')
  publish(@Param('examId', ParseUUIDPipe) examId: string, @Req() request: AuthenticatedRequest) {
    return this.authoring.publish(request.personId, examId);
  }

  @Post(':examId/questions')
  addQuestion(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() body: CreateQuestionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authoring.addQuestion(request.personId, examId, body);
  }

  @Patch(':examId/questions/:questionId')
  updateQuestion(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() body: UpdateQuestionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authoring.updateQuestion(request.personId, examId, questionId, body);
  }

  @Delete(':examId/questions/:questionId')
  async removeQuestion(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.authoring.removeQuestion(request.personId, examId, questionId);
    return { examId, questionId };
  }

  @Post(':examId/questions/:questionId/options')
  addOption(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Body() body: CreateOptionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authoring.addOption(request.personId, examId, questionId, body);
  }

  @Patch(':examId/questions/:questionId/options/:optionId')
  updateOption(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Body() body: UpdateOptionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authoring.updateOption(request.personId, examId, questionId, optionId, body);
  }

  @Delete(':examId/questions/:questionId/options/:optionId')
  async removeOption(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('questionId', ParseUUIDPipe) questionId: string,
    @Param('optionId', ParseUUIDPipe) optionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.authoring.removeOption(request.personId, examId, questionId, optionId);
    return { examId, questionId, optionId };
  }

  // PUT, not PATCH: RULE-EXAM-13's checkbox screen submits the complete set
  // of enabled event types, and the stored list is replaced by it.
  @Put(':examId/monitoring-config')
  setMonitoringConfig(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Body() body: UpdateMonitoringConfigDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authoring.setMonitoringConfig(request.personId, examId, body.monitoringMode, body.monitoredEventTypes);
  }

  // Polled every 5 seconds by the frontend (approved technology decision —
  // polling, not realtime). Each read also resolves sessions whose window
  // has closed into ABANDONED, since no scheduler exists to do it.
  @Get(':examId/sessions')
  sessions(@Param('examId', ParseUUIDPipe) examId: string, @Req() request: AuthenticatedRequest) {
    return this.panel.sessionPanel(request.personId, examId);
  }

  // One student's answers plus the full violation timeline (RULE-EXAM-12).
  @Get(':examId/sessions/:sessionId')
  sessionDetail(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.panel.sessionDetail(request.personId, examId, sessionId);
  }

  // RULE-EXAM-14's manual correction. Objective questions are graded by the
  // server when the session ends and are rejected here.
  @Patch(':examId/sessions/:sessionId/answers/:answerId/grade')
  gradeAnswer(
    @Param('examId', ParseUUIDPipe) examId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
    @Param('answerId', ParseUUIDPipe) answerId: string,
    @Body() body: GradeAnswerDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.grading.gradeAnswer({
      personId: request.personId,
      examId,
      examSessionId: sessionId,
      answerId,
      awardedPoints: body.awardedPoints,
    });
  }
}
