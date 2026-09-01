import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { StudentDirectoryService } from './student-directory.service';

// Dedicated "Alunos" screen (architecture-overview.md, "Escopo confirmado —
// Tela Alunos dedicada"; RULE-INST-11/12) — a separate resource from
// PersonManagementController's /v1/users, rather than a nested route on it,
// mirroring how the rest of the pivot's academic-registration modules
// (course, subject, class-group, holiday) are each their own module. Reuses
// MANAGE_USERS (RULE-INST-12); read-only, so no LeadershipScopeService
// check, same reasoning as GET /v1/users.
@Controller('v1/students')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class StudentDirectoryController {
  constructor(private readonly studentDirectoryService: StudentDirectoryService) {}

  @Get()
  list() {
    return this.studentDirectoryService.list();
  }
}
