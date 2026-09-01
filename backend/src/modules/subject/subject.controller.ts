import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CreateSubjectDto } from './dto/create-subject.dto';
import { SubjectService } from './subject.service';

// RULE-INST-12: no new permission — Matéria reuses MANAGE_INSTITUTION_STRUCTURE,
// same as Curso and Turma.
@Controller('v1/subjects')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class SubjectController {
  constructor(private readonly subjectService: SubjectService) {}

  @Post()
  create(@Body() body: CreateSubjectDto) {
    return this.subjectService.create(body);
  }

  @Get()
  list(@Query('courseId') courseId?: string) {
    return this.subjectService.list(courseId);
  }

  // RULE-INST-08/13: cascades to the subject's turmas, tudo-ou-nada blocked
  // if any of them has recorded attendance activity.
  @Delete(':subjectId')
  async delete(@Param('subjectId', ParseUUIDPipe) subjectId: string, @Req() request: AuthenticatedRequest) {
    await this.subjectService.delete(subjectId, request.personId);
    return { subjectId };
  }
}
