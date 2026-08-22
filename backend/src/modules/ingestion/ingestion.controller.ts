import { Body, Controller, HttpStatus, Post, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Response } from 'express';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { DeviceAuthenticatedRequest, DeviceAuthGuard } from './device-auth.guard';
import { IngestionEventEnvelopeDto } from './dto/ingestion-event-envelope.dto';
import { IngestionService } from './ingestion.service';

@Controller('v1/ingestion')
@UseGuards(DeviceAuthGuard)
@UseInterceptors(TenantContextInterceptor)
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
