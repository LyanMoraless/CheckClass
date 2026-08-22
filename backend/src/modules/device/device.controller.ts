import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { DeviceService } from './device.service';
import { RegisterDeviceDto } from './dto/register-device.dto';

// Physical infrastructure of the institution — MANAGE_INSTITUTION_STRUCTURE,
// same as courses/rooms/class-groups.
@Controller('v1/devices')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_INSTITUTION_STRUCTURE)
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post()
  register(@Body() body: RegisterDeviceDto) {
    return this.deviceService.register(body);
  }

  @Get()
  list() {
    return this.deviceService.list();
  }

  @Post(':deviceId/revoke')
  async revoke(@Param('deviceId', ParseUUIDPipe) deviceId: string) {
    await this.deviceService.revoke(deviceId);
    return { deviceId, status: 'inactive' };
  }
}
