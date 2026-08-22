import { Body, Controller, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ClassSessionService } from './class-session.service';
import { CreateClassSessionDto } from './dto/create-class-session.dto';

@Controller('v1/class-sessions')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
export class ClassSessionController {
  constructor(private readonly classSessionService: ClassSessionService) {}

  @Post()
  @RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
  async create(@Body() body: CreateClassSessionDto) {
    const session = await this.classSessionService.createSession({
      classGroupId: body.classGroupId,
      roomId: body.roomId,
      scheduledStart: new Date(body.scheduledStart),
      scheduledEnd: new Date(body.scheduledEnd),
    });
    return { classSessionId: session.id };
  }
}
