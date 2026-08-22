import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ClassGroupService } from './class-group.service';
import { CreateClassGroupDto } from './dto/create-class-group.dto';
import { EnrollPersonDto } from './dto/enroll-person.dto';

@Controller('v1/class-groups')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class ClassGroupController {
  constructor(private readonly classGroupService: ClassGroupService) {}

  @Post()
  create(@Body() body: CreateClassGroupDto) {
    return this.classGroupService.create(body);
  }

  @Get()
  list(@Query('courseId') courseId?: string) {
    return this.classGroupService.list(courseId);
  }

  @Post(':classGroupId/enrollments')
  enroll(@Param('classGroupId', ParseUUIDPipe) classGroupId: string, @Body() body: EnrollPersonDto) {
    return this.classGroupService.enroll({ classGroupId, personId: body.personId, role: body.role });
  }

  @Get(':classGroupId/enrollments')
  listEnrollments(@Param('classGroupId', ParseUUIDPipe) classGroupId: string) {
    return this.classGroupService.listEnrollments(classGroupId);
  }
}
