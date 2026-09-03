import { IsIn, IsObject, IsOptional } from 'class-validator';
import { MONITORABLE_EVENT_TYPES, MonitorableEventType } from '../exam-vocabulary';

// Security control 4, first line: a client may only ever name an event type
// from the monitorable allow-list. Server-generated types
// (EXAM_TIME_EXPIRED, the lifecycle transitions) are a disjoint set and
// therefore cannot be injected through this payload. ExamMonitoringService
// checks the same list again, because the DTO is a convenience and the
// service is the trust boundary.
//
// occurredAt is absent by design — the server timestamps every audit entry
// itself (RULE-EXAM-07), so there is nothing about the client's clock to
// trust or reject.
export class ReportMonitoringEventDto {
  @IsIn(MONITORABLE_EVENT_TYPES)
  eventType: MonitorableEventType;

  // RULE-EXAM-04's "informações técnicas disponíveis". Free-form by nature,
  // so it is sanitized, truncated and capped in the service before it
  // reaches the audit trail.
  @IsOptional()
  @IsObject()
  details?: Record<string, string>;
}
