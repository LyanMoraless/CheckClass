import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbsenceJustificationAreaGateInterceptor } from './absence-justification-area-gate.interceptor';
import { AbsenceJustificationDecisionService } from './absence-justification-decision.service';
import { AbsenceJustificationPersonScopeInterceptor } from './absence-justification-person-scope.interceptor';
import { DecideAbsenceJustificationItemDto } from './dto/decide-item.dto';
import { RevokeAbsenceJustificationItemDto } from './dto/revoke-item.dto';

// Professor side (RULE-JUST-03/06/08/17/24): deliberately NO
// @RequirePermission — like PendingReviewController.resolve(), authorization
// here is RULE-JUST-24's narrow subject-teacher check, enforced inside
// AbsenceJustificationDecisionService itself (defense-in-depth on top of the
// teacher_subject_scope RLS policy), never the general permission-group
// mechanism.
@Controller('v1/absence-justification-items')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, AbsenceJustificationAreaGateInterceptor, AbsenceJustificationPersonScopeInterceptor)
export class AbsenceJustificationDecisionController {
  constructor(private readonly decisionService: AbsenceJustificationDecisionService) {}

  @Get('queue')
  listQueue(@Req() request: AuthenticatedRequest) {
    return this.decisionService.listQueueForTeacher(request.personId);
  }

  // RULE-JUST-17: the items THIS professor personally decided (latest
  // decision snapshot, decided_by_person_id) — `queue` above only ever
  // returns 'under_review' items, so this is the only way a professor can
  // find an older approval to revoke, or review their own decision history.
  // `status` is an optional, unvalidated passthrough filter (e.g.
  // `?status=approved` to narrow to what's actually revocable) — same
  // shape SecurityIncidentController.list() already uses for a plain
  // optional status query param.
  @Get('decided')
  listDecided(@Query('status') status: string | undefined, @Req() request: AuthenticatedRequest) {
    return this.decisionService.listDecidedByTeacher(request.personId, status);
  }

  @Post(':itemId/decide')
  decide(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: DecideAbsenceJustificationItemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.decisionService.decide(itemId, request.personId, body.decision, body.note);
  }

  @Post(':itemId/revoke')
  revoke(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() body: RevokeAbsenceJustificationItemDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.decisionService.revoke(itemId, request.personId, body.note);
  }
}
