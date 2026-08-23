import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CloseSecurityIncidentDto } from './dto/close-security-incident.dto';
import { SecurityIncidentService } from './security-incident.service';

// Every route here needs MANAGE_SECURITY_INCIDENTS (RULE-SEC-07) — a single
// class-level gate is enough since there's no narrower per-route variant
// today (unlike PendingReviewController's listUnresolved()/resolve() split).
@Controller('v1/security-incidents')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_SECURITY_INCIDENTS)
export class SecurityIncidentController {
  constructor(private readonly securityIncidentService: SecurityIncidentService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.securityIncidentService.list(status);
  }

  @Get(':incidentId')
  getById(@Param('incidentId', ParseUUIDPipe) incidentId: string) {
    return this.securityIncidentService.getById(incidentId);
  }

  @Post(':incidentId/close')
  async close(
    @Param('incidentId', ParseUUIDPipe) incidentId: string,
    @Body() body: CloseSecurityIncidentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.securityIncidentService.close(incidentId, request.personId, body.outcome, body.note);
    return { incidentId, outcome: body.outcome };
  }
}
