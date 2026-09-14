import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RegisterPersonalDeviceDto } from './dto/register-personal-device.dto';
import { PersonalDeviceService } from './personal-device.service';

// RULE-DEV-02: self-service, any authenticated person — no @RequirePermission,
// same "act on MY OWN data" posture as AppCheckinController. revoke() and
// findByPerson() are the two routes where the target isn't necessarily "mine"
// (RULE-DEV-18's second titular, Direção/Reitoria) — authorized inside the
// service, not here.
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

  // RULE-DEV-18 admin flow: Direção/Reitoria searches a person's active BYOD
  // by personId before revoking it administratively — 'by-person' is a
  // literal path segment, so it never collides with the ':id/revoke' route
  // below. Authorized inside the service (same Direção/Reitoria check as
  // revoke()'s admin branch), not here.
  @Get('by-person/:personId')
  findByPerson(@Param('personId', ParseUUIDPipe) personId: string, @Req() request: AuthenticatedRequest) {
    return this.personalDeviceService.findByPerson(personId, request.personId);
  }

  @Post(':id/revoke')
  async revoke(@Param('id', ParseUUIDPipe) id: string, @Req() request: AuthenticatedRequest) {
    await this.personalDeviceService.revoke(id, request.personId);
    return { id, status: 'revoked' };
  }
}
