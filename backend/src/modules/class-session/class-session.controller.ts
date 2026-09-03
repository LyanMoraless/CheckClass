import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ClassSessionService } from './class-session.service';
import { CreateClassSessionDto } from './dto/create-class-session.dto';
import { EditClassSessionDto } from './dto/edit-class-session.dto';

@Controller('v1/class-sessions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
export class ClassSessionController {
  constructor(private readonly classSessionService: ClassSessionService) {}

  // RULE-INST-09: MANAGE_INSTITUTION_STRUCTURE below is necessary but not
  // sufficient — ClassSessionService.createSession additionally enforces the
  // cumulative leadership-scope check, same as edit()/cancel() below.
  @Post()
  @RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
  async create(@Body() body: CreateClassSessionDto, @Req() request: AuthenticatedRequest) {
    const session = await this.classSessionService.createSession(
      {
        classGroupId: body.classGroupId,
        subjectId: body.subjectId,
        roomId: body.roomId,
        scheduledStart: new Date(body.scheduledStart),
        scheduledEnd: new Date(body.scheduledEnd),
      },
      request.personId,
    );
    return { classSessionId: session.id };
  }

  // Also allowed for VIEW_ATTENDANCE_REGISTER holders: the attendance
  // register roster screens need a classSessionId to look up, and a caller
  // gated only by that permission couldn't otherwise discover which
  // sessions exist (permission-boundary gap fixed per Solution Architect).
  @Get()
  @RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE, Permission.VIEW_ATTENDANCE_REGISTER)
  list(@Query('classGroupId') classGroupId?: string, @Query('subjectId') subjectId?: string) {
    return this.classSessionService.list({ classGroupId, subjectId });
  }

  // RULE-INST-04 (third-round update, item #3): pontual edit of one already-
  // generated session (horário/sala/data). MANAGE_INSTITUTION_STRUCTURE below
  // is necessary but not sufficient — RULE-INST-09's cumulative leadership-
  // authority check (Coordenador de Curso OR the turma's Professor(es),
  // RULE-INST-05 co-docência included) is enforced inside
  // ClassSessionService.editSession, same pattern as ClassScheduleController.
  @Patch(':id')
  @RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
  async edit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: EditClassSessionDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const session = await this.classSessionService.editSession(
      id,
      {
        scheduledStart: new Date(body.scheduledStart),
        scheduledEnd: new Date(body.scheduledEnd),
        roomId: body.roomId,
      },
      request.personId,
    );
    return {
      classSessionId: session.id,
      status: session.status,
      scheduledStart: session.scheduledStart,
      scheduledEnd: session.scheduledEnd,
      roomId: session.roomId,
    };
  }

  // RULE-INST-04 (third-round update, items #1-#2): pontual cancellation —
  // never deletes the row (see ClassSessionService.cancelSession's doc).
  // Same cumulative authorization as edit() above.
  @Patch(':id/cancel')
  @RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    const session = await this.classSessionService.cancelSession(id, request.personId);
    return { classSessionId: session.id, status: session.status };
  }
}
