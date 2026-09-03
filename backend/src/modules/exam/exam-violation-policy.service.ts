import { Injectable } from '@nestjs/common';
import { MonitorableEventType, MonitoringMode } from './exam-vocabulary';

// What the policy decided should happen to the session. Named after the
// effect, not after the mode, so that a future per-event-type policy can
// return TERMINATE_SESSION for one event and LOG_ONLY for another within the
// same exam without any of the callers changing.
export type ViolationAction = 'TERMINATE_SESSION' | 'LOG_ONLY';

// Everything the decision may legitimately depend on. eventType is already
// here even though no current strategy reads it: RULE-EXAM-05 explicitly
// requires the architecture to be able to grow into per-event-type policies
// "sem reconstrução do módulo", and that only holds if the input the future
// rule needs is already flowing through the seam.
export interface ViolationContext {
  monitoringMode: MonitoringMode;
  eventType: MonitorableEventType;
}

export interface ViolationPolicyStrategy {
  readonly mode: MonitoringMode;
  decide(context: ViolationContext): ViolationAction;
}

// RULE-EXAM-04, "encerramento automático": a violation ends the session
// immediately; answers already synchronized are preserved (nothing here
// deletes them) and the state becomes TERMINATED.
class TerminateStrategy implements ViolationPolicyStrategy {
  readonly mode: MonitoringMode = 'TERMINATE';

  decide(): ViolationAction {
    return 'TERMINATE_SESSION';
  }
}

// RULE-EXAM-04, "apenas registro": record and let the student continue, so
// the teacher can review the whole timeline afterwards.
class LogOnlyStrategy implements ViolationPolicyStrategy {
  readonly mode: MonitoringMode = 'LOG_ONLY';

  decide(): ViolationAction {
    return 'LOG_ONLY';
  }
}

// Component 4 of the approved architecture. A Strategy rather than an if/else
// because RULE-EXAM-05 asks for room to grow: adding a third mode, or making
// the decision depend on the event type, means registering another strategy
// here — not reworking ExamMonitoringService or ExamSessionService, neither
// of which knows anything about how the decision is reached.
//
// The policy is a pure decision: it never touches the session itself.
// Applying its outcome is ExamSessionService's job, which keeps RULE-EXAM-09
// true by construction — nothing in this file can see or influence the timer.
@Injectable()
export class ExamViolationPolicyService {
  private readonly strategies: ReadonlyMap<MonitoringMode, ViolationPolicyStrategy>;

  constructor() {
    const registered: ViolationPolicyStrategy[] = [new TerminateStrategy(), new LogOnlyStrategy()];
    this.strategies = new Map(registered.map((strategy) => [strategy.mode, strategy]));
  }

  decide(context: ViolationContext): ViolationAction {
    const strategy = this.strategies.get(context.monitoringMode);
    if (!strategy) {
      // Unreachable through the API (the mode is CHECK-constrained in the
      // database and @IsIn-validated in the DTO), so an unknown mode means
      // corrupt data — fail closed rather than silently letting a monitored
      // exam behave as if it had no policy at all.
      throw new Error(`No violation policy strategy registered for monitoring mode ${context.monitoringMode}`);
    }
    return strategy.decide(context);
  }
}
