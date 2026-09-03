import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// Security requirement for the monitoring-report endpoint: the rate limit
// must be scoped to (tenant_id, exam_session_id), not to the IP the global
// ThrottlerGuard tracks. Two reasons the default tracker is not enough here:
// a whole classroom behind one NAT shares an IP (one student's burst would
// throttle everyone else's legitimate events), and conversely a single
// student on several IPs could keep hammering the audit trail.
//
// The session id is not in the request, and resolving it would mean a
// database round trip before the throttle decision — which is exactly the
// work the throttle exists to avoid. It is not needed: exam_session has
// UNIQUE (tenant_id, exam_id, person_id), so (tenant, exam, person) names
// exactly one session. The tracker below IS the session key, expressed with
// values already present on the verified request.
@Injectable()
export class ExamEventThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const tenantId = req.tenantId as string | undefined;
    const personId = req.personId as string | undefined;
    const examId = (req.params as Record<string, string> | undefined)?.examId;

    if (!tenantId || !personId || !examId) {
      // Should be unreachable (JwtAuthGuard runs first and the route has an
      // :examId), but falling back to the IP is the safe direction: still
      // throttled, just less precisely.
      return super.getTracker(req);
    }
    return `exam-event:${tenantId}:${examId}:${personId}`;
  }
}
