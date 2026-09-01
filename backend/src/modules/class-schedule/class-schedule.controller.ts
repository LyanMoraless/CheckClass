import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ClassScheduleService } from './class-schedule.service';
import { CreateScheduleSlotDto } from './dto/create-schedule-slot.dto';

// MANAGE_INSTITUTION_STRUCTURE (RequirePermission below) is necessary but not
// sufficient — RULE-INST-09 additionally requires leadership authority over
// the turma's course, enforced inside ClassScheduleService via
// LeadershipScopeService. Same cumulative pattern already used by
// ClassGroupController (RULE-INST-12: the two checks are cumulative, never
// an alternative to one another).
@Controller('v1/class-groups/:classGroupId/schedule-slots')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class ClassScheduleController {
  constructor(private readonly classScheduleService: ClassScheduleService) {}

  @Post()
  create(
    @Param('classGroupId', ParseUUIDPipe) classGroupId: string,
    @Body() body: CreateScheduleSlotDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.classScheduleService.createSlot(classGroupId, body, request.personId);
  }

  @Get()
  list(@Param('classGroupId', ParseUUIDPipe) classGroupId: string) {
    return this.classScheduleService.listSlots(classGroupId);
  }

  @Delete(':slotId')
  async delete(
    @Param('classGroupId', ParseUUIDPipe) classGroupId: string,
    @Param('slotId', ParseUUIDPipe) slotId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.classScheduleService.deleteSlot(classGroupId, slotId, request.personId);
    return { classGroupId, slotId };
  }

  // RULE-INST-04: bulk-generates class_session rows from this turma's
  // recurring grade across its whole term period, skipping holidays and
  // already-generated (date, slot) combinations — see
  // ClassScheduleService.generateSessions for the idempotency decision.
  // Nested under /schedule-slots (an action on "the recurring grade as a
  // whole", not a CRUD resource of its own) rather than a new top-level
  // route — same shape as class-group's nested /enrollments sub-resource.
  @Post('generate-sessions')
  generateSessions(@Param('classGroupId', ParseUUIDPipe) classGroupId: string, @Req() request: AuthenticatedRequest) {
    return this.classScheduleService.generateSessions(classGroupId, request.personId);
  }
}
