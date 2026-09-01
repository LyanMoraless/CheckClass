import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ClassGroupService } from './class-group.service';
import { CreateClassGroupDto } from './dto/create-class-group.dto';
import { EnrollPersonDto } from './dto/enroll-person.dto';
import { UpdateEnrollmentStatusDto } from './dto/update-enrollment-status.dto';

// MANAGE_INSTITUTION_STRUCTURE (RequirePermission below) is necessary but
// not sufficient for create/enroll/unenroll — RULE-INST-09 additionally
// requires leadership authority over the turma's course, enforced inside
// ClassGroupService via LeadershipScopeService. The two checks are
// cumulative (RULE-INST-12), never an alternative to one another.
@Controller('v1/class-groups')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class ClassGroupController {
  constructor(private readonly classGroupService: ClassGroupService) {}

  @Post()
  create(@Body() body: CreateClassGroupDto, @Req() request: AuthenticatedRequest) {
    return this.classGroupService.create(body, request.personId);
  }

  @Get()
  list(@Query('subjectId') subjectId?: string) {
    return this.classGroupService.list(subjectId);
  }

  // RULE-INST-08/13: hard delete, blocked if the turma has recorded
  // attendance activity (ClassGroupDeletionOrchestrator).
  @Delete(':classGroupId')
  async delete(@Param('classGroupId', ParseUUIDPipe) classGroupId: string, @Req() request: AuthenticatedRequest) {
    await this.classGroupService.delete(classGroupId, request.personId);
    return { classGroupId };
  }

  @Post(':classGroupId/enrollments')
  enroll(
    @Param('classGroupId', ParseUUIDPipe) classGroupId: string,
    @Body() body: EnrollPersonDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.classGroupService.enroll({ classGroupId, personId: body.personId, role: body.role }, request.personId);
  }

  @Get(':classGroupId/enrollments')
  listEnrollments(@Param('classGroupId', ParseUUIDPipe) classGroupId: string) {
    return this.classGroupService.listEnrollments(classGroupId);
  }

  // RULE-INST-11: enrollment_status has free transitions between its four
  // values, no state machine — any value in UpdateEnrollmentStatusDto's
  // @IsIn list can become any other. Part of the turma's composition/
  // management, same cumulative authorization as enroll/unenroll.
  @Patch(':classGroupId/enrollments/:personId/status')
  updateEnrollmentStatus(
    @Param('classGroupId', ParseUUIDPipe) classGroupId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() body: UpdateEnrollmentStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.classGroupService.updateEnrollmentStatus(
      { classGroupId, personId, status: body.status },
      request.personId,
    );
  }

  // RULE-INST-05: removing a teacher's enrollment here also revokes the
  // class_group-scoped leadership_assignment that enrollment granted — see
  // ClassGroupService.unenroll.
  @Delete(':classGroupId/enrollments/:personId')
  async unenroll(
    @Param('classGroupId', ParseUUIDPipe) classGroupId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.classGroupService.unenroll({ classGroupId, personId }, request.personId);
    return { classGroupId, personId };
  }
}
