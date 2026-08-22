import { Body, Controller, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SetRequiredFactorsDto } from './dto/set-required-factors.dto';
import { UpsertConfigDto } from './dto/upsert-config.dto';
import { TenantConfigService } from './tenant-config.service';

@Controller('v1/config')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
export class ConfigController {
  constructor(private readonly configService: TenantConfigService) {}

  @Post()
  @RequirePermission(Permission.CONFIGURE_ATTENDANCE_RULES)
  async upsert(@Body() body: UpsertConfigDto) {
    const config = await this.configService.upsertConfig({
      scopeType: body.scopeType,
      scopeId: body.scopeId ?? null,
      minAttendancePercentage: body.minAttendancePercentage,
      toleranceMinutes: body.toleranceMinutes,
      postToleranceBehavior: body.postToleranceBehavior,
    });
    return { configId: config.id };
  }

  @Post(':configId/required-factors')
  @RequirePermission(Permission.CONFIGURE_ATTENDANCE_RULES)
  async setRequiredFactors(@Param('configId', ParseUUIDPipe) configId: string, @Body() body: SetRequiredFactorsDto) {
    await this.configService.setRequiredFactors(configId, body.factorTypeIds);
    return { configId, factorTypeIds: body.factorTypeIds };
  }
}
