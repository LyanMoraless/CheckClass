import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
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

  // Added for the admin frontend: no read path existed for either of these
  // before — the config screen needs to show existing configs and the
  // available factor types before offering to change them.
  @Get()
  @RequirePermission(Permission.CONFIGURE_ATTENDANCE_RULES)
  listConfigs() {
    return this.configService.listConfigs();
  }

  @Get('factor-types')
  @RequirePermission(Permission.CONFIGURE_ATTENDANCE_RULES)
  listFactorTypes() {
    return this.configService.listFactorTypes();
  }

  @Post()
  @RequirePermission(Permission.CONFIGURE_ATTENDANCE_RULES)
  async upsert(@Body() body: UpsertConfigDto) {
    const config = await this.configService.upsertConfig({
      scopeType: body.scopeType,
      scopeId: body.scopeId ?? null,
      minAttendancePercentage: body.minAttendancePercentage,
      minAccumulatedFrequencyPercentage: body.minAccumulatedFrequencyPercentage,
      accumulatedFrequencyPeriod: body.accumulatedFrequencyPeriod,
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
