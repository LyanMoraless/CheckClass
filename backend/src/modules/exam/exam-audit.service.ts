import { Injectable } from '@nestjs/common';
import { ExamSessionEntity, ExamSessionEventEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { MONITORABLE_EVENT_TYPES, MonitorableEventType, SERVER_EVENT_TYPES, ServerEventType } from './exam-vocabulary';

export interface ExamAuditEntry {
  id: string;
  eventType: string;
  treatedAsViolation: boolean;
  details: Record<string, unknown> | null;
  occurredAt: Date;
}

export interface ExamSessionEventStats {
  examSessionId: string;
  eventCount: number;
  violationCount: number;
  lastEventAt: Date | null;
}

type SessionRef = Pick<ExamSessionEntity, 'id' | 'personId'>;

// Component 6 of the approved architecture: the append-only trail of
// RULE-EXAM-12, plus the reads the teacher's panel is built on.
//
// Append-only is not a convention here — exam_session_event has UPDATE/DELETE
// revoked AND a trigger that refuses them for every role (see AddExamArea
// migration). This service therefore only ever inserts; there is deliberately
// no update/delete method to call by accident.
//
// Security control 4 shows up as the two separate write methods below.
// A client-reported event and a server-generated one are different trust
// levels, so they are different functions with different allow-lists,
// instead of one method taking an event type from wherever the caller got
// it. Nothing a student sends can reach recordServerEvent's vocabulary.
@Injectable()
export class ExamAuditService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Lifecycle events (start, expiry, completion, termination, abandonment).
  // Reachable only from ExamSessionService — never from a request payload.
  async recordServerEvent(
    session: SessionRef,
    eventType: ServerEventType,
    details?: Record<string, unknown>,
  ): Promise<void> {
    if (!SERVER_EVENT_TYPES.includes(eventType)) {
      throw new Error(`${eventType} is not a server-generated exam event type`);
    }
    await this.append(session, eventType, false, details);
  }

  // Monitoring occurrences observed by the browser. The allow-list is
  // re-checked here even though the DTO already validated it, because this
  // method is the trust boundary, not the DTO: a future internal caller must
  // not be able to smuggle a lifecycle event type in through the client path.
  async recordClientEvent(
    session: SessionRef,
    eventType: MonitorableEventType,
    treatedAsViolation: boolean,
    details?: Record<string, unknown>,
  ): Promise<void> {
    if (!MONITORABLE_EVENT_TYPES.includes(eventType)) {
      throw new Error(`${eventType} is not a client-reportable exam event type`);
    }
    await this.append(session, eventType, treatedAsViolation, details);
  }

  async timeline(examSessionId: string): Promise<ExamAuditEntry[]> {
    const events = await this.tenantContext.getManager().getRepository(ExamSessionEventEntity).find({
      where: { examSessionId },
      order: { occurredAt: 'ASC' },
    });

    return events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      treatedAsViolation: event.treatedAsViolation,
      details: event.details,
      occurredAt: event.occurredAt,
    }));
  }

  // Aggregated in SQL rather than by loading every event: the teacher's
  // panel polls this every 5 seconds for a whole class group, and the
  // timeline of one session can be long by design.
  async statsBySession(examSessionIds: string[]): Promise<Map<string, ExamSessionEventStats>> {
    if (examSessionIds.length === 0) {
      return new Map();
    }

    const rows: Array<{
      exam_session_id: string;
      event_count: string;
      violation_count: string;
      last_event_at: Date | null;
    }> = await this.tenantContext.getManager().query(
      `
      SELECT exam_session_id,
             COUNT(*) AS event_count,
             COUNT(*) FILTER (WHERE treated_as_violation) AS violation_count,
             MAX(occurred_at) AS last_event_at
      FROM exam_session_event
      WHERE exam_session_id = ANY($1::uuid[])
      GROUP BY exam_session_id
      `,
      [examSessionIds],
    );

    return new Map(
      rows.map((row) => [
        row.exam_session_id,
        {
          examSessionId: row.exam_session_id,
          eventCount: Number(row.event_count),
          violationCount: Number(row.violation_count),
          lastEventAt: row.last_event_at,
        },
      ]),
    );
  }

  private async append(
    session: SessionRef,
    eventType: string,
    treatedAsViolation: boolean,
    details?: Record<string, unknown>,
  ): Promise<void> {
    const repository = this.tenantContext.getManager().getRepository(ExamSessionEventEntity);

    // occurredAt is intentionally not set here: it is written by the
    // server/database, never accepted from a client (RULE-EXAM-07).
    await repository.save(
      repository.create({
        tenantId: this.tenantContext.getTenantId(),
        examSessionId: session.id,
        personId: session.personId,
        eventType,
        treatedAsViolation,
        details: details ?? null,
      }),
    );
  }
}
