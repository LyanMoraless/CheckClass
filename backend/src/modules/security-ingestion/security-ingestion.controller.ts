import { Body, Controller, HttpStatus, Post, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { DeviceAuthenticatedRequest, DeviceAuthGuard } from '../ingestion/device-auth.guard';
import { RequireDeviceType } from '../ingestion/require-device-type.decorator';
import { SecurityIngestionEventEnvelopeDto } from './dto/security-ingestion-event-envelope.dto';
import { SecurityIngestionService } from './security-ingestion.service';

// Approved endpoint path (architecture-overview.md, Tech Decision item 3):
// POST /v1/security-ingestion/events. Reuses DeviceAuthGuard as-is (ratified
// device-auth mechanism covers both device gateways, not a new decision).
// @RequireDeviceType restricts this gateway to the two canonical security
// device types the same tech decision names (item 3: "barreira IR, leitor
// de área") — an attendance-pipeline device's leaked API key must never
// authenticate here, and vice versa.
@Controller('v1/security-ingestion')
@UseGuards(DeviceAuthGuard)
@UseInterceptors(TenantContextInterceptor)
@RequireDeviceType('ir_barrier', 'area_reader')
export class SecurityIngestionController {
  constructor(private readonly securityIngestionService: SecurityIngestionService) {}

  @Post('events')
  async ingestEvent(
    @Body() envelope: SecurityIngestionEventEnvelopeDto,
    @Req() request: DeviceAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.securityIngestionService.ingest(request.deviceId, envelope);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return { eventId: result.eventId, created: result.created };
  }
}
