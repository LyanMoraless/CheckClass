import { Body, Controller, HttpStatus, Post, Req, Res, UseGuards, UseInterceptors } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ClassMonitoringSignalThrottlerGuard } from './class-monitoring-signal-throttler.guard';
import { ClassMonitoringSignalService } from './class-monitoring-signal.service';
import { ReportClassMonitoringSignalDto } from './dto/report-class-monitoring-signal.dto';

// Ceiling against abuse/scripting, not a normal-use limit — RULE-PRES-09's
// monitor emits at most ~1 reading/minute by design (distanceInterval/
// timeInterval in use-class-monitoring.ts), same idiom as
// ExamEventThrottlerGuard's own EVENT_REPORT_LIMIT comment.
const SIGNAL_REPORT_LIMIT = 20;
const SIGNAL_REPORT_TTL_MS = 60_000;

// RULE-PRES-09 (architecture-overview.md's "Implementação — endpoint de
// ingestão de raw_location_signal", closing the gap flagged in
// "Implementação — App Mobile"'s item 4). Same family as POST /v1/app-checkin:
// person-JWT-authenticated, deliberately NOT a variant of the device-
// authenticated ingestion contract — personId is NEVER accepted from the
// body, only from request.personId set by JwtAuthGuard from the verified JWT.
@Controller('v1/class-monitoring-signals')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class ClassMonitoringSignalController {
  constructor(private readonly classMonitoringSignalService: ClassMonitoringSignalService) {}

  // ClassMonitoringSignalThrottlerGuard/@Throttle applied at the method level
  // (not the class), same placement ExamStudentController uses for its own
  // per-event throttle — class-level JwtAuthGuard above runs first, so
  // request.personId/tenantId are always set before this guard's getTracker
  // reads them. Composes with (does not replace) the global IP-based
  // ThrottlerGuard already registered as APP_GUARD in app.module.ts.
  @Post()
  @UseGuards(ClassMonitoringSignalThrottlerGuard)
  @Throttle({ default: { limit: SIGNAL_REPORT_LIMIT, ttl: SIGNAL_REPORT_TTL_MS } })
  async report(
    @Body() dto: ReportClassMonitoringSignalDto,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.classMonitoringSignalService.report(request.personId, dto);
    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);
    return { signalId: result.signalId, created: result.created };
  }
}
