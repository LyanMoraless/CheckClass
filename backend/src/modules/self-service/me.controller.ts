import { Controller, Get, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AttendanceRegisterService } from '../attendance-register/attendance-register.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MyScheduleService } from './my-schedule.service';

// RULE-ATT-15: any authenticated person can always read their OWN
// consolidated attendance/schedule, independent of permission-group
// membership. Deliberately a SEPARATE route family from the admin-facing
// GET /v1/register/... (AttendanceRegisterController) — not a retrofit of
// those routes, which stay permission-gated and unchanged.
//
// Guarded by JwtAuthGuard + TenantContextInterceptor ONLY: no
// PermissionCheckInterceptor/@RequirePermission at all. "Is this MY OWN
// data" is a structurally different authorization question from the
// permission-group system (manage_users / configure_attendance_rules /
// view_attendance_register / manage_institution_structure, all
// admin/staff-profile grants over *anyone's* data) — it's not one more
// permission to hold, it's unconditional for any authenticated person per
// RULE-ATT-15.
//
// personId is NEVER accepted as a route/query/body param here — it comes
// exclusively from request.personId, set by JwtAuthGuard from the verified
// JWT, so it can never be spoofed to read someone else's data (same idiom
// PendingReviewController.resolve() already uses for resolvingPersonId).
@Controller('v1/me')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class MeController {
  constructor(
    private readonly registerService: AttendanceRegisterService,
    private readonly scheduleService: MyScheduleService,
  ) {}

  @Get('attendance')
  getMyAttendance(@Req() request: AuthenticatedRequest, @Query('classGroupId') classGroupId?: string) {
    return this.registerService.getPersonHistory(request.personId, classGroupId);
  }

  @Get('schedule')
  getMySchedule(@Req() request: AuthenticatedRequest) {
    return this.scheduleService.getMySchedule(request.personId);
  }
}
