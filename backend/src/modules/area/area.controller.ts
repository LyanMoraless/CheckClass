import { Body, Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { AreaService } from './area.service';
import { CreateAreaDto } from './dto/create-area.dto';

// Areas are the institution's physical/organizational structure (bloco ->
// área/andar/corredor), the same conceptual bucket courses/rooms/class-groups
// already sit under — hence MANAGE_INSTITUTION_STRUCTURE rather than a new
// permission code.
@Controller('v1/areas')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class AreaController {
  constructor(private readonly areaService: AreaService) {}

  @Post()
  create(@Body() body: CreateAreaDto) {
    return this.areaService.create(body);
  }

  @Get()
  list() {
    return this.areaService.list();
  }
}
