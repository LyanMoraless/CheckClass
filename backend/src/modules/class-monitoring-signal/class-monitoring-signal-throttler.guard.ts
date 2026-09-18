import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// RULE-PRES-09's monitor can be running for every enrolled student in a room
// at once, potentially all behind the same institutional Wi-Fi/NAT — the same
// problem ExamEventThrottlerGuard already solved for exam monitoring events
// (see that guard's own comment). The global IP-based ThrottlerGuard
// (app.module.ts) would throttle an entire classroom from one student's
// burst, or let one student switching IPs bypass the limit entirely, so this
// tracks per (tenant, person) instead.
//
// Unlike ExamEventThrottlerGuard, classSessionId is deliberately NOT part of
// the tracker key: that guard reads it from a route param (`:examId`),
// always present and already routed on before any guard runs; this
// endpoint's classSessionId lives in the request body instead, which Nest's
// pipes (including class-validator) have not run yet by the time a Guard
// executes — reading an unvalidated body field here would make the tracker
// key itself untrustworthy.
@Injectable()
export class ClassMonitoringSignalThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const tenantId = req.tenantId as string | undefined;
    const personId = req.personId as string | undefined;

    if (!tenantId || !personId) {
      // Should be unreachable (JwtAuthGuard runs first, see this feature's
      // controller guard ordering), but falling back to the IP is the safe
      // direction: still throttled, just less precisely.
      return super.getTracker(req);
    }
    return `class-monitoring-signal:${tenantId}:${personId}`;
  }
}
