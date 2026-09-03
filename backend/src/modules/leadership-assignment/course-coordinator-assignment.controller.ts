import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CourseCoordinatorAssignmentService } from './course-coordinator-assignment.service';
import { CreateCourseCoordinatorAssignmentDto } from './dto/create-course-coordinator-assignment.dto';

// Item 7 of the Backend Agent's handoff (architecture-overview.md, "Decisão
// de arquitetura — Portal de Autoatendimento Web, estrutura", point 5):
// "quem exatamente pode fazer essa atribuição" was left as a Backend Agent
// detail — gated on MANAGE_INSTITUTION_STRUCTURE, the same permission
// already gating every other institution-structure write (CourseController,
// SubjectController, ClassGroupController), rather than inventing a new
// permission (RULE-INST-12: no new Permission enum values for this pivot).
// Deliberately does NOT also require LeadershipScopeService authority the
// way RULE-INST-09 gates montar/editar turma — assigning a Coordenador de
// Curso is itself an institution-structure operation (who gets to lead a
// course), not an operation scoped BY an existing leadership assignment, so
// there's no leadership scope to check against yet for a brand-new
// coordinator.
@Controller('v1/course-coordinator-assignments')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class CourseCoordinatorAssignmentController {
  constructor(private readonly service: CourseCoordinatorAssignmentService) {}

  @Post()
  assign(@Body() body: CreateCourseCoordinatorAssignmentDto) {
    return this.service.assign(body);
  }

  @Get()
  list() {
    return this.service.list();
  }

  @Delete(':assignmentId')
  async revoke(@Param('assignmentId', ParseUUIDPipe) assignmentId: string) {
    await this.service.revoke(assignmentId);
    return { assignmentId };
  }
}
