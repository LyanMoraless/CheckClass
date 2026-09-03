import { BadRequestException, Injectable } from '@nestjs/common';
import { ExamAuditService } from './exam-audit.service';
import { ExamSessionService } from './exam-session.service';
import { ExamViolationPolicyService, ViolationAction } from './exam-violation-policy.service';
import { sanitizeExamText } from './exam-content-sanitizer';
import { MONITORABLE_EVENT_TYPES, MonitorableEventType, MonitoringMode, PAGE_RELOAD_EVENT_TYPE } from './exam-vocabulary';

// Client-supplied technical context (RULE-EXAM-04's "informações técnicas
// disponíveis"). Bounded on purpose — see sanitizeDetails below.
const MAX_DETAIL_ENTRIES = 10;
const MAX_DETAIL_VALUE_LENGTH = 500;

export interface ReportEventInput {
  eventType: MonitorableEventType;
  details?: Record<string, string>;
}

export interface ReportEventResult {
  recorded: boolean;
  treatedAsViolation: boolean;
  action: ViolationAction | null;
  sessionStatus: string;
}

// Component 3 of the approved architecture: the one door a browser-reported
// monitoring occurrence comes through. It decides only two things — is this
// event even monitored, and does it count as a violation — and delegates
// everything else: the reaction to ExamViolationPolicyService, the write to
// ExamAuditService, the state change to ExamSessionService.
//
// It never decides expiry and never reads the timer, which is RULE-EXAM-09's
// independence expressed as a dependency graph rather than as a comment.
@Injectable()
export class ExamMonitoringService {
  constructor(
    private readonly sessions: ExamSessionService,
    private readonly policy: ExamViolationPolicyService,
    private readonly audit: ExamAuditService,
  ) {}

  async report(personId: string, examId: string, input: ReportEventInput): Promise<ReportEventResult> {
    // Second check of Security control 4's allow-list, after the DTO's:
    // this method is the trust boundary, and a server-only event type such
    // as EXAM_TIME_EXPIRED must be impossible to inject here even if a
    // future caller bypasses the DTO.
    if (!MONITORABLE_EVENT_TYPES.includes(input.eventType)) {
      throw new BadRequestException(`${input.eventType} is not a reportable monitoring event type`);
    }

    // Also revalidates expiry: reporting an event on a session whose time
    // ran out fails here rather than appending to a dead session's trail.
    const { session } = await this.sessions.requireActiveSession(personId, examId);

    // RULE-EXAM-05: the exam only monitors the types the teacher enabled —
    // read from the session's SNAPSHOT, not from the exam's current
    // configuration, so a mid-flight edit cannot change what this run is
    // being monitored for.
    const enabled = session.monitoredEventTypesSnapshot.includes(input.eventType);
    const isPageReload = input.eventType === PAGE_RELOAD_EVENT_TYPE;

    // PAGE_RELOAD is the one exception to the enablement filter:
    // RULE-EXAM-11 says the reload "deve ser registrado", flatly, with no
    // "if enabled" clause — unlike RULE-EXAM-05's other types. So a reload
    // is always audited, and only whether it COUNTS as a violation depends
    // on the teacher having enabled it.
    if (!enabled && !isPageReload) {
      return { recorded: false, treatedAsViolation: false, action: null, sessionStatus: session.status };
    }

    const treatedAsViolation = enabled;
    await this.audit.recordClientEvent(session, input.eventType, treatedAsViolation, this.sanitizeDetails(input.details));

    if (!treatedAsViolation) {
      return { recorded: true, treatedAsViolation: false, action: null, sessionStatus: session.status };
    }

    const action = this.policy.decide({
      monitoringMode: session.monitoringModeSnapshot as MonitoringMode,
      eventType: input.eventType,
    });

    if (action === 'TERMINATE_SESSION') {
      const terminated = await this.sessions.terminateForViolation(session, input.eventType);
      return { recorded: true, treatedAsViolation: true, action, sessionStatus: terminated.status };
    }

    return { recorded: true, treatedAsViolation: true, action, sessionStatus: session.status };
  }

  // details is free-form jsonb written by a client and later rendered on the
  // teacher's timeline, which makes it the same stored-XSS surface as exam
  // content (Security control 7) — and, unbounded, a cheap way to bloat the
  // audit trail. So: string values only, each sanitized and truncated, and a
  // hard cap on how many keys are kept.
  private sanitizeDetails(details?: Record<string, string>): Record<string, unknown> | undefined {
    if (!details) {
      return undefined;
    }

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(details).slice(0, MAX_DETAIL_ENTRIES)) {
      if (typeof value !== 'string') {
        continue;
      }
      sanitized[sanitizeExamText(key).slice(0, MAX_DETAIL_VALUE_LENGTH)] = sanitizeExamText(value).slice(
        0,
        MAX_DETAIL_VALUE_LENGTH,
      );
    }
    return sanitized;
  }
}
