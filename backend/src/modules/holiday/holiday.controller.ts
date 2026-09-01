import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { HolidayService } from './holiday.service';

// Institutional calendar CRUD — MANAGE_INSTITUTION_STRUCTURE alone gates this
// (see HolidayService's top-of-file comment for why no LeadershipScopeService
// check is needed here, unlike ClassScheduleController).
@Controller('v1/holidays')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class HolidayController {
  constructor(private readonly holidayService: HolidayService) {}

  @Post()
  create(@Body() body: CreateHolidayDto) {
    return this.holidayService.create(body);
  }

  @Get()
  list() {
    return this.holidayService.list();
  }

  @Delete(':id')
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.holidayService.delete(id);
    return { id };
  }
}
