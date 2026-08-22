import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AttendanceRegisterService } from './attendance-register.service';

@Controller('v1/register')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.VIEW_ATTENDANCE_REGISTER)
export class AttendanceRegisterController {
  constructor(private readonly registerService: AttendanceRegisterService) {}

  @Get('session/:classSessionId')
  getSessionRegister(@Param('classSessionId', ParseUUIDPipe) classSessionId: string) {
    return this.registerService.getSessionRegister(classSessionId);
  }

  @Get('person/:personId')
  getPersonHistory(@Param('personId', ParseUUIDPipe) personId: string, @Query('classGroupId') classGroupId?: string) {
    return this.registerService.getPersonHistory(personId, classGroupId);
  }

  @Get('class-group/:classGroupId')
  getClassGroupSummary(@Param('classGroupId', ParseUUIDPipe) classGroupId: string) {
    return this.registerService.getClassGroupSummary(classGroupId);
  }
}
