import { Body, Controller, HttpStatus, Post, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { DeviceAuthenticatedRequest, DeviceAuthGuard } from './device-auth.guard';
import { IngestionEventEnvelopeDto } from './dto/ingestion-event-envelope.dto';
import { IngestionService } from './ingestion.service';
import { RequireDeviceType } from './require-device-type.decorator';

// Attendance pipeline's device-ingestion gateway — every registered
// attendance edge device in this codebase (create-device.ts, the
// integration fixtures) uses device_type 'raspberry_pi' (one physical
// gateway multiplexing tag/facial/room/camera-count signals into this one
// event stream, differentiated by IngestionEventType instead of by device
// type). @RequireDeviceType turns that into an enforced boundary so a
// security-domain device (ir_barrier/area_reader) can never authenticate
// here, not just a documentation note.
@Controller('v1/ingestion')
@UseGuards(DeviceAuthGuard)
@UseInterceptors(TenantContextInterceptor)
@RequireDeviceType('raspberry_pi')
export class IngestionController {
  constructor(private readonly ingestionService: IngestionService) {}

  @Post('events')
  async ingestEvent(
    @Body() envelope: IngestionEventEnvelopeDto,
    @Req() request: DeviceAuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.ingestionService.ingest(request.deviceId, envelope);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return { eventId: result.eventId, created: result.created };
  }
}
