import { Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AbsenceJustificationAreaGateInterceptor } from './absence-justification-area-gate.interceptor';
import { AbsenceJustificationNoticeReadService } from './absence-justification-notice-read.service';
import { AbsenceJustificationPersonScopeInterceptor } from './absence-justification-person-scope.interceptor';

// RULE-JUST-21/22: exclusive to the student titular — no professor,
// coordenação or direção access of any kind, mirroring RULE-FREQ-04's
// student-only avisos area (which this is a sibling of, not a merge into —
// see AbsenceJustificationNoticeReadService's header).
//
// RULE-JUST-10 defense in depth: notices only ever exist off the back of an
// absence_justification_item, itself unreachable for a non-faculdade tenant
// — but the gate is applied here too, same as the other two controllers in
// this module, for consistency rather than because a bypass path exists.
@Controller('v1/absence-justification-notices')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, AbsenceJustificationAreaGateInterceptor, AbsenceJustificationPersonScopeInterceptor)
export class AbsenceJustificationNoticeController {
  constructor(private readonly noticeReadService: AbsenceJustificationNoticeReadService) {}

  @Get()
  listMine(@Req() request: AuthenticatedRequest) {
    return this.noticeReadService.listMine(request.personId);
  }

  @Post(':noticeId/dismiss')
  async dismiss(@Param('noticeId', ParseUUIDPipe) noticeId: string, @Req() request: AuthenticatedRequest) {
    await this.noticeReadService.dismiss(noticeId, request.personId);
    return { noticeId, dismissed: true };
  }
}
