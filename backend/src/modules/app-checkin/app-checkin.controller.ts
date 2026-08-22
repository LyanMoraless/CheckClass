import { Body, Controller, HttpStatus, Post, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppCheckinService } from './app-checkin.service';
import { AppCheckinDto } from './dto/app-checkin.dto';

// RULE-ATT-06's confirmed note (2026-08-22): app check-in is a person-JWT-
// authenticated capability, explicitly NOT a variant of the device-
// authenticated ingestion contract (IngestionController, POST
// /v1/ingestion/events, class-level DeviceAuthGuard) — deliberately its own
// controller, not a route bolted onto IngestionController (mixing a
// person-JWT route onto a class-level DeviceAuthGuard-guarded controller is
// exactly the class-vs-method-level authorization subtlety this codebase's
// Security/Code-Review agents already flagged and fixed once elsewhere).
//
// Guard shape mirrors MeController (JwtAuthGuard + TenantContextInterceptor
// only, no PermissionCheckInterceptor/@RequirePermission): "submit MY OWN
// check-in" is the same kind of self-scoped, permission-group-independent
// action as RULE-ATT-15's "read MY OWN data" — personId is NEVER accepted
// from the body, only from request.personId set by the guard from the
// verified JWT.
@Controller('v1/app-checkin')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class AppCheckinController {
  constructor(private readonly appCheckinService: AppCheckinService) {}

  @Post()
  async checkIn(
    @Body() dto: AppCheckinDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.appCheckinService.submit(request.personId, dto);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return { eventId: result.eventId, created: result.created };
  }
}
