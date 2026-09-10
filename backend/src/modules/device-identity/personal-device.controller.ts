import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterPersonalDeviceDto } from './dto/register-personal-device.dto';
import { PersonalDeviceService } from './personal-device.service';

// RULE-DEV-02: self-service, any authenticated person — no @RequirePermission,
// same "act on MY OWN data" posture as AppCheckinController. revoke() is the
// one route where the target isn't necessarily "mine" (RULE-DEV-18's second
// titular, Direção/Reitoria) — authorized inside the service, not here.
@Controller('v1/device-identity/personal-devices')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class PersonalDeviceController {
  constructor(private readonly personalDeviceService: PersonalDeviceService) {}

  @Post()
  register(@Body() body: RegisterPersonalDeviceDto, @Req() request: AuthenticatedRequest) {
    return this.personalDeviceService.register(request.personId, body.label ?? null);
  }

  @Get('me')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.personalDeviceService.getMine(request.personId);
  }

  @Post(':id/revoke')
  async revoke(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    await this.personalDeviceService.revoke(id, request.personId);
    return { id, status: 'revoked' };
  }
}
