import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ResolvePendingReviewDto } from './dto/resolve-pending-review.dto';
import { PendingReviewService } from './pending-review.service';

// resolve() deliberately has NO @RequirePermission — that authorization is
// RULE-ATT-12's leadership chain, already enforced inside
// PendingReviewService.resolve() itself, not the general permission-group
// mechanism. listUnresolved() DOES need a gate, though: security review
// finding — it was reachable by anyone with a valid JWT for the tenant,
// exposing every pending review (including its reason) with no check at
// all. Gated on VIEW_ATTENDANCE_REGISTER (the closest existing permission
// to "can see tenant-wide attendance data") rather than inventing a new one.
@Controller('v1/pending-reviews')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class PendingReviewController {
  constructor(private readonly pendingReviewService: PendingReviewService) {}

  @Get()
  @UseInterceptors(PermissionCheckInterceptor)
  @RequirePermission(Permission.VIEW_ATTENDANCE_REGISTER)
  listUnresolved() {
    return this.pendingReviewService.listUnresolved();
  }

  // Mobile Professor use case (RULE-ATT-12): a narrower, leadership-chain
  // -scoped view — "only what I'm authorized to resolve", not the whole
  // tenant. Deliberately no @RequirePermission/PermissionCheckInterceptor,
  // same reasoning as resolve(): RULE-ATT-12's leadership chain is its own
  // authorization mechanism, not a permission-group concept, and it's
  // already enforced (inverted into a filter) inside the service. Leaves
  // listUnresolved() above completely untouched — the web admin dashboard
  // already depends on its current behavior/gating.
  @Get('mine')
  listUnresolvedForPerson(@Req() request: AuthenticatedRequest) {
    return this.pendingReviewService.listUnresolvedForPerson(request.personId);
  }

  @Post(':pendingReviewId/resolve')
  async resolve(
    @Param('pendingReviewId', ParseUUIDPipe) pendingReviewId: string,
    @Body() body: ResolvePendingReviewDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.pendingReviewService.resolve(pendingReviewId, request.personId, body.decision, body.note);
    return { pendingReviewId, decision: body.decision };
  }
}
