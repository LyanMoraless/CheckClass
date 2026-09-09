import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbsenceJustificationAreaGateInterceptor } from './absence-justification-area-gate.interceptor';
import { AbsenceJustificationAttachmentService } from './absence-justification-attachment.service';
import { AbsenceJustificationPersonScopeInterceptor } from './absence-justification-person-scope.interceptor';
import { AbsenceJustificationSubmissionService } from './absence-justification-submission.service';
import { ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES } from './absence-justification.constants';
import { CreateAbsenceJustificationSubmissionDto } from './dto/create-submission.dto';

// Student-facing side of Frente 07 (RULE-JUST-01/05/06/13-16). "My own data"
// idiom (RULE-ATT-15's precedent, same shape MeController already uses for
// GET /v1/me/*): no permission gate — personId always comes from the
// verified JWT, never from a param, so a student can never touch another
// student's request.
@Controller('v1/absence-justifications')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, AbsenceJustificationAreaGateInterceptor, AbsenceJustificationPersonScopeInterceptor)
export class AbsenceJustificationSubmissionController {
  constructor(
    private readonly submissionService: AbsenceJustificationSubmissionService,
    private readonly attachmentService: AbsenceJustificationAttachmentService,
  ) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES } }))
  create(
    @Body() body: CreateAbsenceJustificationSubmissionDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.submissionService.create(request.personId, body, file);
  }

  @Get('mine')
  listMine(@Req() request: AuthenticatedRequest) {
    return this.submissionService.listMine(request.personId);
  }

  @Get(':submissionId/items')
  listItems(@Param('submissionId', ParseUUIDPipe) submissionId: string, @Req() request: AuthenticatedRequest) {
    return this.submissionService.listItemsForSubmission(submissionId, request.personId);
  }

  @Post(':submissionId/cancel')
  async cancel(@Param('submissionId', ParseUUIDPipe) submissionId: string, @Req() request: AuthenticatedRequest) {
    await this.submissionService.cancel(submissionId, request.personId);
    return { submissionId, status: 'cancelled' };
  }

  // RULE-JUST-08/11.5/24: reachable by the titular AND by the subject
  // -teacher of any matéria in this submission — see
  // AbsenceJustificationAttachmentService.authorize() for the actual gate.
  // Streams the bytes straight from storage into the response body; never a
  // redirect and never a signed URL (RULE-JUST-11.5).
  @Get(':submissionId/attachment')
  async downloadAttachment(
    @Param('submissionId', ParseUUIDPipe) submissionId: string,
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ) {
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] ?? null : userAgentHeader ?? null;

    const attachment = await this.attachmentService.download(submissionId, {
      requesterPersonId: request.personId,
      ipAddress: request.ip ?? request.socket.remoteAddress ?? '0.0.0.0',
      userAgent,
    });

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.originalFilename)}"`);
    response.send(attachment.body);
  }

  // RULE-JUST-11.4: "o aluno titular sempre pode ver o próprio anexo e
  // saber quem o abriu" — titular-only (AbsenceJustificationAttachmentService
  // .listAccessLogForSubmission enforces that, on top of the log's own
  // student_ownership_read RLS policy). Nested under :submissionId/attachment,
  // matching downloadAttachment above, rather than introducing an
  // :attachmentId param this module has no other use for — the 1:1
  // submission/attachment relationship (absence_justification_attachment_
  // submission_unique) already makes ":submissionId/attachment" the
  // resource's own address.
  @Get(':submissionId/attachment/access-log')
  listAttachmentAccessLog(@Param('submissionId', ParseUUIDPipe) submissionId: string, @Req() request: AuthenticatedRequest) {
    return this.attachmentService.listAccessLogForSubmission(submissionId, request.personId);
  }
}
