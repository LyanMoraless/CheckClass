import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { GuardianLinkFollowupService } from './guardian-link-followup.service';

// "Varredura periódica como rede de segurança" (usuário, 2026-09-15,
// architecture-overview.md): no cron/notification exists, so this report IS
// the discovery mechanism. Same Secretaria-exclusive allowlist already used
// by PersonManagementController's getDateOfBirth/confirmDateOfBirth
// (RequirePermission(MANAGE_USERS) at class level, no method-level
// widening) — the Security Agent required this be its own module (not
// folded into PersonManagementController) since it is a tenant-wide report,
// not a per-person resource.
@Controller('v1/guardian-link-followups')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class GuardianLinkFollowupController {
  constructor(private readonly guardianLinkFollowupService: GuardianLinkFollowupService) {}

  @Get()
  listAllOpen() {
    return this.guardianLinkFollowupService.listAllOpen();
  }
}
