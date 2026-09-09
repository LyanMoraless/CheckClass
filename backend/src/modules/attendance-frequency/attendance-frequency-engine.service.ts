import { Injectable, NotFoundException } from '@nestjs/common';
import { ClassGroupEntity, ClassSessionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { addUtcDays } from '../../common/utc-date.util';
import { ResolvedAttendanceConfig, TenantConfigService } from '../config/tenant-config.service';
import { AttendanceWarningService } from './attendance-warning.service';
import { currentPeriodWindow, ReportingPeriodWindow, sameWindow } from './reporting-period.util';

// The result of one accumulated-frequency calculation, as a DISCRIMINATED
// UNION rather than `number | null` (approved addendum, section B4). This is
// structural, not stylistic: with a nullable number, a caller that forgot the
// null branch would read 0 present out of 0 considered as 0% and raise a
// below_minimum warning — the worst false positive this feature can produce,
// telling a student they are failing by absence in a matéria that has not had
// a single evaluated class yet. There is no percentage to read unless
// `calculable` is true.
export type FrequencyCalculation =
  | { calculable: false; reason: 'no_definitive_sessions' | 'no_period_window' }
  | { calculable: true; presentCount: number; consideredCount: number; percentage: number };

interface ClassGroupContext {
  classGroup: ClassGroupEntity;
  config: ResolvedAttendanceConfig;
}

interface FrequencyCountsRow {
  considered_count: string;
  present_count: string;
}

interface PersonSubjectPairRow {
  class_group_id: string;
  subject_id: string;
}

// "Motor de Controle B" (architecture-overview.md, Frente 06): accumulated
// frequency per (student, turma, matéria) over the current reporting period
// (RULE-FREQ-01/02/05), stacked ON TOP of Controle A without touching it —
// AttendanceRulesEngineService keeps a zero diff and is only read from, through
// the session_attendance_consolidation rows it writes.
//
// MODULE INVARIANTS, both load-bearing for tenant isolation:
//
// 1. This service NEVER opens a transaction of its own
//    (dataSource.transaction) and never uses a manager other than
//    this.tenantContext.getManager(). TenantContextService.runWithTenant
//    already wraps the whole request in one transaction and that is precisely
//    what makes RLS work — `SET LOCAL app.tenant_id` is transaction-scoped.
//    A nested transaction here either escapes that scope or creates a
//    savepoint whose rollback semantics no caller expects.
// 2. recalculateForSessionPerson does NOT accept an EntityManager. Every
//    caller is already inside the request's transaction by construction, so
//    the parameter would buy nothing and would allow passing a manager
//    without `app.tenant_id` — a silent RLS bypass. The "Unchecked" internal
//    primitives that DO take a manager
//    (ClassGroupDeletionOrchestrator.removeSubjectFromClassGroup) are a
//    different case: there the parameter marks "you are inside someone else's
//    unit of work", not an escape from the tenant context.
//
// This service is deliberately AGNOSTIC to enrollment_status: whether a
// warning may be raised for this person is AttendanceWarningService's
// decision (RULE-FREQ-08.2 — frequency stays calculable for on_leave /
// graduated / withdrawn, only warning generation stops).
@Injectable()
export class AttendanceFrequencyEngineService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantConfig: TenantConfigService,
    private readonly warningService: AttendanceWarningService,
  ) {}

  // THE single entry primitive of Controle B (RULE-FREQ-06). Every call site
  // that turns a session_attendance_consolidation row definitive calls this,
  // in the same transaction, AFTER its own update — calling it before would
  // read the pre-resolution state. Today: PendingReviewService.resolve(),
  // the session-evaluate CLI script, and Frente 07's approve()/revoke() in
  // AbsenceJustificationDecisionService.
  //
  // RULE-JUST-23 (Solution Architect addendum, 2026-09-08): the recalculation
  // is driven by the SESSION'S OWN reporting-period window
  // (session.scheduledStart), not by "now" — a Frente 07 decision can land
  // after the period has turned over, because a pedido never expires
  // (RULE-JUST-15.4). Signature is UNCHANGED: recalculate() below resolves
  // referenceDate = session.scheduledStart internally, exactly as this
  // method already had the session loaded to read subjectId from.
  async recalculateForSessionPerson(classSessionId: string, personId: string): Promise<FrequencyCalculation> {
    const manager = this.tenantContext.getManager();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }

    const context = await this.loadClassGroupContext(session.classGroupId);
    return this.recalculate(context, session.subjectId, personId, session.scheduledStart);
  }

  // RULE-JUST-21 item 4 / RULE-JUST-23 addendum: Frente 07's approval flow
  // needs the frequency percentage BEFORE the consolidation row flips to
  // 'absent_justified' (to word the notice as "de 72% para 78%"), read
  // WITHOUT writing anything — recalculateForSessionPerson always writes
  // (RULE-FREQ-06's "no second method, no event" is about avoiding a second
  // WRITE primitive; this performs none, so it does not violate that
  // contract). Same session/window resolution as recalculateForSessionPerson,
  // minus the call to AttendanceWarningService.applyCalculation.
  async previewForSessionPerson(classSessionId: string, personId: string): Promise<FrequencyCalculation> {
    const manager = this.tenantContext.getManager();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }

    const context = await this.loadClassGroupContext(session.classGroupId);
    const window = currentPeriodWindow(
      context.classGroup.termStartDate,
      context.classGroup.termEndDate,
      context.config.accumulatedFrequencyPeriod,
      session.scheduledStart,
    );

    return window
      ? this.countInWindow(context.classGroup.id, session.subjectId, personId, window)
      : { calculable: false, reason: 'no_period_window' };
  }

  // Lazy reconciliation for one student, used by GET /v1/me/warnings — see
  // FrequencyWarningReadService for why a read path recomputes at all.
  // Enumerates the (turma, matéria) pairs the student is enrolled into and
  // runs the same primitive over each, so late enrollment (RULE-FREQ-05.4),
  // period turnover, a changed configuration and an edited term all
  // self-correct without a trigger of their own.
  async reconcileForPerson(personId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const pairs: PersonSubjectPairRow[] = await manager.query(
      `
      SELECT cgs.class_group_id, cgs.subject_id
      FROM class_group_enrollment cge
      JOIN class_group_subject cgs ON cgs.class_group_id = cge.class_group_id
      WHERE cge.tenant_id = $1
        AND cge.person_id = $2
        AND cge.role = 'student'
      ORDER BY cgs.class_group_id, cgs.subject_id
      `,
      [tenantId, personId],
    );

    // Enrollments of every status are enumerated on purpose: an active
    // warning of a student who has just been trancado/evadido has to be
    // closed (RULE-FREQ-08.2), which cannot happen if the pair is filtered
    // out here.
    const contextsByClassGroup = new Map<string, ClassGroupContext>();
    for (const pair of pairs) {
      let context = contextsByClassGroup.get(pair.class_group_id);
      if (!context) {
        context = await this.loadClassGroupContext(pair.class_group_id);
        contextsByClassGroup.set(pair.class_group_id, context);
      }
      // Unchanged behaviour: "now" was always the reference date here, and
      // still is — RULE-JUST-23's addendum only changes
      // recalculateForSessionPerson's caller.
      await this.recalculate(context, pair.subject_id, personId, new Date());
    }
  }

  // referenceDate (RULE-JUST-23 addendum): the window this recalculation
  // measures is sliced from referenceDate, not always "now" — callers pass
  // session.scheduledStart (Frente 07 approvals/revocations, and every
  // ordinary Controle A call site, where the session just became definitive)
  // or literally `new Date()` (reconcileForPerson's lazy read-path
  // reconciliation, unchanged).
  //
  // shouldApplyCalculation GUARD (Solution Architect addendum): a HISTORICAL
  // non-null window — one that does not match what "now" resolves to — must
  // never reach AttendanceWarningService.applyCalculation. This is possible
  // only because a Frente 07 pedido never expires (RULE-JUST-15.4) and may
  // be decided after its own period has already turned over:
  // closeIfPeriodTurnedOver would compare that stale window against the
  // active (current-period) warning, see a mismatch, and wrongly resolve the
  // CORRECT active warning as period_closed (or insert a warning for an
  // already-closed period, exactly what RULE-JUST-23 item 4 forbids). A NULL
  // window is a DIFFERENT, pre-existing case (RULE-FREQ-08 approved answer
  // 6's "freeze" — e.g. no term dates yet) and is NOT guarded: it always
  // reaches applyCalculation, exactly as before this addendum. The caller
  // still gets the correct FrequencyCalculation back either way — only the
  // persisted warning row is left untouched for a historical window.
  private async recalculate(
    context: ClassGroupContext,
    subjectId: string,
    personId: string,
    referenceDate: Date,
  ): Promise<FrequencyCalculation> {
    const window = currentPeriodWindow(
      context.classGroup.termStartDate,
      context.classGroup.termEndDate,
      context.config.accumulatedFrequencyPeriod,
      referenceDate,
    );

    const calculation = window
      ? await this.countInWindow(context.classGroup.id, subjectId, personId, window)
      : ({ calculable: false, reason: 'no_period_window' } as const);

    // window === null is the PRE-EXISTING "freeze" case (RULE-FREQ-08
    // approved answer 6 — e.g. a turma with no term dates yet) and must
    // still reach applyCalculation exactly as before RULE-JUST-23: that is
    // what lets AttendanceWarningService decide to freeze an already-issued
    // warning instead of silently retracting it. The guard below is ONLY
    // about a non-null window that is HISTORICAL — i.e. does not match the
    // window "now" resolves to (RULE-JUST-23's actual target: a Frente 07
    // decision landing after its own período de apuração already turned
    // over, or after the term itself ended).
    const currentWindow = currentPeriodWindow(
      context.classGroup.termStartDate,
      context.classGroup.termEndDate,
      context.config.accumulatedFrequencyPeriod,
      new Date(),
    );
    const shouldApplyCalculation = window === null || (currentWindow !== null && sameWindow(window, currentWindow));

    if (shouldApplyCalculation) {
      await this.warningService.applyCalculation({
        personId,
        classGroupId: context.classGroup.id,
        subjectId,
        window,
        minPercentage: context.config.minAccumulatedFrequencyPercentage,
        calculation,
      });
    }

    return calculation;
  }

  // THE QUERY IS DRIVEN BY class_session, WITH A LEFT JOIN ONTO
  // session_attendance_consolidation — never the other way round. This was
  // wrong once in the design and the mistake is easy to reintroduce, so:
  // RULE-FREQ-05.4 says the denominator counts from the start of the period,
  // not from the student's enrollment. A student enrolled late has NO
  // consolidation row at all for the earlier sessions, so counting THAT
  // PERSON'S rows would make those sessions vanish from the denominator and
  // the student would not be charged for them — the exact opposite of the
  // rule.
  //
  // Denominator: sessions where this person's row is present/absent/
  // absent_justified, OR the person has no row AND the session has already
  // been evaluated.
  // Numerator:   sessions where this person's row is present OR
  //              absent_justified.
  // Out:         `pending` sessions (RULE-FREQ-05.1) and sessions not
  //              evaluated yet.
  //
  // RULE-JUST-07/RULE-JUST-03 addendum (2026-09-02): an approved
  // justification flips a session_attendance_consolidation row to
  // 'absent_justified', a 4th, distinguishable status added by Frente 07
  // (AddAbsenceJustificationToAttendanceConsolidation migration) — never a
  // rewrite to 'present', which would erase the fact that the student did
  // not actually attend. It counts as presença in THIS query's numerator
  // (33/40, never 32/39) while staying out of Controle A's/every other
  // consumer's notion of 'present'.
  //
  // "Already evaluated" is an EXISTS of ANY consolidation row for that
  // session, for any person (approved answer 4). It is not a clock guess:
  // `scheduled_end < now()` was rejected because it would charge the student
  // for sessions nobody ever evaluated (there is no "class ended" scheduler —
  // session-evaluate.ts records that in its own comment), and an
  // `evaluated_at` column on class_session was rejected to keep the zero-diff
  // commitment over Controle A's territory intact. The accepted cost: a
  // session evaluated without producing a single consolidation row would fall
  // out of the denominator.
  private async countInWindow(
    classGroupId: string,
    subjectId: string,
    personId: string,
    window: ReportingPeriodWindow,
  ): Promise<FrequencyCalculation> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows: FrequencyCountsRow[] = await manager.query(
      `
      SELECT
        COUNT(*) AS considered_count,
        COUNT(*) FILTER (WHERE c.status IN ('present', 'absent_justified')) AS present_count
      FROM class_session cs
      LEFT JOIN session_attendance_consolidation c
        ON c.tenant_id = cs.tenant_id
       AND c.class_session_id = cs.id
       AND c.person_id = $3
      WHERE cs.tenant_id = $1
        AND cs.class_group_id = $2
        AND cs.subject_id = $4
        AND cs.scheduled_start >= $5
        AND cs.scheduled_start < $6
        AND (
          c.status IN ('present', 'absent', 'absent_justified')
          OR (
            c.id IS NULL
            AND EXISTS (
              SELECT 1
              FROM session_attendance_consolidation evaluated
              WHERE evaluated.tenant_id = cs.tenant_id
                AND evaluated.class_session_id = cs.id
            )
          )
        )
      `,
      [
        tenantId,
        classGroupId,
        personId,
        subjectId,
        window.startDate,
        // Half-open upper bound: the window's end date is inclusive, and
        // scheduled_start is an instant, so the comparison runs against the
        // midnight that starts the following day.
        addUtcDays(window.endDate, 1),
      ],
    );

    const consideredCount = Number(rows[0]?.considered_count ?? 0);
    const presentCount = Number(rows[0]?.present_count ?? 0);
    if (consideredCount === 0) {
      return { calculable: false, reason: 'no_definitive_sessions' };
    }

    // Rounded here, in TypeScript, from the integer counts — Math.round
    // rounds .5 up, identically to Postgres' ROUND on numeric, so service and
    // database can never disagree about a boundary case (69,5 → 70).
    // RULE-FREQ-05.3: BOTH comparisons run on this rounded integer, which is
    // why it is also the value persisted on the warning row; the raw counts
    // travel with it so the UI can say "33 de 40 aulas".
    return {
      calculable: true,
      presentCount,
      consideredCount,
      percentage: Math.round((presentCount * 100) / consideredCount),
    };
  }

  // The configuration is resolved LIVE, on every recalculation, and never
  // snapshotted — see the comment on TenantConfigService.resolveEffectiveConfig
  // for why Controle B diverges from Controle A here (RULE-FREQ-02 addendum).
  private async loadClassGroupContext(classGroupId: string): Promise<ClassGroupContext> {
    const manager = this.tenantContext.getManager();

    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }

    return { classGroup, config: await this.tenantConfig.resolveEffectiveConfig(classGroupId) };
  }
}
