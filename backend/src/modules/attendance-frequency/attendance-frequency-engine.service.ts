import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ClassGroupEntity,
  ClassSessionEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { addUtcDays, hydrateNullableDate } from '../../common/utc-date.util';
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

// The vocabulary of session_attendance_consolidation.status (see that
// entity's own comment — the column predates its CHECK constraint and is
// still typed as a bare `string` there). Declared here, not imported from the
// entity, purely so the diff math below (contributionOf) reads
// self-evidently against a closed set of values instead of an open `string`.
export type ConsolidationStatus = 'pending' | 'present' | 'absent' | 'absent_justified';

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

// One (class_session, person) row's transition, as recalculate() needs it to
// correct the durable period aggregate (Frente 10) by exactly the DIFFERENCE
// this transition makes — never by re-adding the session's full weight, since
// the same session can reach recalculateForSessionPerson more than once over
// its life (pending -> absent via PendingReviewService.resolve(), then
// absent -> absent_justified via AbsenceJustificationDecisionService.
// approve(), then back via revoke() — RULE-JUST-17.4). `newStatus` is never
// part of this shape: it is always read fresh, by the engine itself, from
// session_attendance_consolidation — see recalculateForSessionPerson.
interface SessionStatusChange {
  classSessionId: string;
  previousStatus: ConsolidationStatus | null;
  newStatus: ConsolidationStatus | null;
}

// What one status value (or the absence of a row) contributes to this
// person's numerator/denominator — the same vocabulary countInWindow's SQL
// used to express in a single query, now expressed once here so both the
// bootstrap rescan and the incremental diff agree on it by construction
// instead of by two independently-maintained pieces of SQL/TypeScript.
// `null` (no row for this session/person yet) contributes nothing: whether a
// session with NO row for this specific person still belongs in someone
// ELSE's denominator (RULE-FREQ-05.4, late enrollment) is a fact about that
// OTHER person's aggregate, decided by the bootstrap rescan below — never by
// this function, which only ever describes THIS person's own row.
function contributionOf(status: ConsolidationStatus | null): { considered: number; present: number } {
  switch (status) {
    case 'present':
    case 'absent_justified':
      return { considered: 1, present: 1 };
    case 'absent':
      return { considered: 1, present: 0 };
    case 'pending':
    case null:
      return { considered: 0, present: 0 };
    default: {
      // Exhaustiveness guard: a 5th status would be schema/engine drift this
      // table has never had to handle — fail loudly rather than silently
      // mis-count the aggregate.
      const exhaustiveCheck: never = status;
      throw new Error(`AttendanceFrequencyEngineService: unknown consolidation status "${String(exhaustiveCheck)}"`);
    }
  }
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
//
// FRENTE 10 (Conformidade LGPD e retenção) ADDENDUM: RULE-RET-01 purges
// session_attendance_consolidation after 60 days, and a reporting period can
// span up to 6 months (semester). The full-window rescan this engine used to
// run on every recalculation (`countInWindow`, now `fullRescanCounts`) would
// silently under-count once the expurgo starts removing rows it depended on
// rereading. The fix, approved as the resolution to the Frente 10
// architecture's Open Question 1: a durable, incremental aggregate
// (`attendance_frequency_period_aggregate`, one row per person/turma/
// matéria/period) that is BOOTSTRAPPED once, via the same full rescan, the
// first time a period is ever computed for a person — and from then on only
// ever corrected by the DIFFERENCE one session's status transition makes
// (`contributionOf(newStatus) - contributionOf(previousStatus)`), never by
// re-reading the whole window again. See `readOrUpdateAggregate` below for
// the mechanism, and the entity/migration files for the schema.
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
  // `previousStatus` (Frente 10 addition): the status this SAME (session,
  // person) row had BEFORE the write the caller just made — 'pending' for a
  // fresh PendingReviewService.resolve(), null for a session/person pair
  // evaluated for the first time, or whatever conditional-UPDATE predicate
  // the caller itself just relied on (Frente 07's approve()/revoke() know
  // their own previous status for free: their UPDATE is WHERE status = ...).
  // The NEW status is deliberately NOT a parameter — it is read here, by a
  // single-row lookup against session_attendance_consolidation (never the
  // full-window rescan the aggregate exists to replace), because every
  // caller has already written it, in this same transaction, immediately
  // before calling this method.
  //
  // RULE-JUST-23 (Solution Architect addendum, 2026-09-08): the recalculation
  // is driven by the SESSION'S OWN reporting-period window
  // (session.scheduledStart), not by "now" — a Frente 07 decision can land
  // after the period has turned over, because a pedido never expires
  // (RULE-JUST-15.4). Signature is otherwise UNCHANGED: recalculate() below
  // resolves referenceDate = session.scheduledStart internally, exactly as
  // this method already had the session loaded to read subjectId from.
  async recalculateForSessionPerson(
    classSessionId: string,
    personId: string,
    previousStatus: ConsolidationStatus | null = null,
  ): Promise<FrequencyCalculation> {
    const manager = this.tenantContext.getManager();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }

    const consolidation = await manager
      .getRepository(SessionAttendanceConsolidationEntity)
      .findOneBy({ classSessionId, personId });
    const newStatus = (consolidation?.status as ConsolidationStatus | undefined) ?? null;

    const context = await this.loadClassGroupContext(session.classGroupId);
    return this.recalculate(context, session.subjectId, personId, session.scheduledStart, {
      classSessionId,
      previousStatus,
      newStatus,
    });
  }

  // RULE-JUST-21 item 4 / RULE-JUST-23 addendum: Frente 07's approval flow
  // needs the frequency percentage BEFORE the consolidation row flips to
  // 'absent_justified' (to word the notice as "de 72% para 78%"), read
  // WITHOUT writing anything — recalculateForSessionPerson always writes
  // (RULE-FREQ-06's "no second method, no event" is about avoiding a second
  // WRITE primitive; this performs none, so it does not violate that
  // contract). Same session/window resolution as recalculateForSessionPerson,
  // minus the call to AttendanceWarningService.applyCalculation.
  //
  // Frente 10: reads the already-persisted aggregate and never writes it —
  // in the (expected-to-be-rare) case that aggregate does not exist yet, this
  // falls back to a read-only rescan rather than the write-capable bootstrap
  // recalculate() uses, to keep this method's "never writes" contract exact.
  async previewForSessionPerson(classSessionId: string, personId: string): Promise<FrequencyCalculation> {
    const manager = this.tenantContext.getManager();

    const session = await manager.getRepository(ClassSessionEntity).findOneBy({ id: classSessionId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }

    const context = await this.loadClassGroupContext(session.classGroupId);
    const window = currentPeriodWindow(
      hydrateNullableDate(context.classGroup.termStartDate),
      hydrateNullableDate(context.classGroup.termEndDate),
      context.config.accumulatedFrequencyPeriod,
      session.scheduledStart,
    );

    return window
      ? this.readAggregateCalculation(context.classGroup.id, session.subjectId, personId, window)
      : { calculable: false, reason: 'no_period_window' };
  }

  // Lazy reconciliation for one student, used by GET /v1/me/warnings — see
  // FrequencyWarningReadService for why a read path recomputes at all.
  // Enumerates the (turma, matéria) pairs the student is enrolled into and
  // runs the same primitive over each, so late enrollment (RULE-FREQ-05.4),
  // period turnover, a changed configuration and an edited term all
  // self-correct without a trigger of their own — including, since Frente 10,
  // BOOTSTRAPPING this person's aggregate for a period it has never touched
  // before (see readOrUpdateAggregate): this is the mechanism that keeps
  // late enrollment correct without a dedicated event of its own, as long as
  // the student's warnings are read at least once before the 60-day purge
  // reaches that period's earliest sessions.
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
      // recalculateForSessionPerson's caller. No sessionUpdate: this is a
      // window-level resync, not a specific session's transition.
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
    sessionUpdate: SessionStatusChange | null = null,
  ): Promise<FrequencyCalculation> {
    const window = currentPeriodWindow(
      hydrateNullableDate(context.classGroup.termStartDate),
      hydrateNullableDate(context.classGroup.termEndDate),
      context.config.accumulatedFrequencyPeriod,
      referenceDate,
    );

    const calculation = window
      ? await this.readOrUpdateAggregate(context.classGroup.id, subjectId, personId, window, sessionUpdate)
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
      hydrateNullableDate(context.classGroup.termStartDate),
      hydrateNullableDate(context.classGroup.termEndDate),
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

  // WRITE PATH (Frente 10) — recalculate()'s source of truth: reads, and
  // when necessary creates or corrects, the durable per-period aggregate
  // instead of rescanning the whole window on every call.
  //
  //   - No existing aggregate row: this is the first time this (person,
  //     turma, matéria, period) has ever been computed. There is nothing to
  //     diff against, so a full rescan (fullRescanCounts, the same query
  //     Controle B always ran before this table existed) becomes the
  //     aggregate's baseline — and it already reflects sessionUpdate's own
  //     effect, because every caller writes session_attendance_consolidation
  //     BEFORE calling recalculateForSessionPerson. Applying the diff on top
  //     afterwards would double-count it.
  //   - An existing row and no sessionUpdate (reconcileForPerson's lazy
  //     resync): nothing session-specific to apply — report what is already
  //     persisted. Genuine period turnover / a changed configuration / an
  //     edited term all express themselves as a DIFFERENT window, which
  //     would have missed the lookup above and bootstrapped instead.
  //   - An existing row and a sessionUpdate: apply exactly the difference
  //     between the old and new contribution of that one session
  //     (contributionOf), atomically, in the database — never a blind "+1"
  //     (see the class-level comment and contributionOf's own comment for
  //     why a session's contribution can change after it was already
  //     counted).
  //
  // LOST-UPDATE FIX (Testing Agent finding, Frente 10): at READ COMMITTED
  // (Postgres' default) the "does a row exist yet? -> bootstrap or diff"
  // sequence above is a check-then-act race. Two transactions touching
  // DIFFERENT sessions of the SAME (tenant, person, class_group, subject,
  // period) at once — e.g. PendingReviewService.resolve() on session A
  // racing GET /v1/me/warnings' reconcileForPerson() on session B, or two
  // Frente 07 decisions on different sessions decided by different
  // professors in parallel — would each run their OWN full rescan seeing
  // only their own uncommitted write, not the other's. Whichever commits
  // first wins the INSERT; the loser's `insertAggregate` ON CONFLICT DO
  // NOTHING fallback SELECT would then hand back the winner's row and this
  // method would return it as-is, silently discarding the loser's own
  // contribution forever — present_count/considered_count would be wrong
  // with no error, no log, and (after RULE-RET-01's 60-day purge) no way to
  // audit it back. A transaction-scoped Postgres advisory lock
  // (pg_advisory_xact_lock), keyed on exactly this aggregate's identity and
  // taken BEFORE the existence check, serializes bootstrap and diff-update
  // for that key: the second transaction blocks here until the first
  // commits and releases the lock, then re-runs this entire method's logic
  // against the NOW-current row — so it always applies its own diff on top
  // of the winner's row instead of ever silently accepting it as-is. Same
  // pattern DeduplicationService already uses for its own check-then-act
  // race (see that service's own comment).
  private async readOrUpdateAggregate(
    classGroupId: string,
    subjectId: string,
    personId: string,
    window: ReportingPeriodWindow,
    sessionUpdate: SessionStatusChange | null,
  ): Promise<FrequencyCalculation> {
    await this.lockAggregateIdentity(classGroupId, subjectId, personId, window);

    const existing = await this.findAggregate(classGroupId, subjectId, personId, window);

    if (!existing) {
      const counts = await this.fullRescanCounts(classGroupId, subjectId, personId, window);
      const created = await this.insertAggregate(classGroupId, subjectId, personId, window, counts);
      return this.toCalculation(created.presentCount, created.consideredCount);
    }

    if (!sessionUpdate) {
      return this.toCalculation(existing.presentCount, existing.consideredCount);
    }

    const before = contributionOf(sessionUpdate.previousStatus);
    const after = contributionOf(sessionUpdate.newStatus);
    const presentDelta = after.present - before.present;
    const consideredDelta = after.considered - before.considered;

    if (presentDelta === 0 && consideredDelta === 0) {
      return this.toCalculation(existing.presentCount, existing.consideredCount);
    }

    const updated = await this.applyAggregateDelta(existing.id, presentDelta, consideredDelta);
    return this.toCalculation(updated.presentCount, updated.consideredCount);
  }

  // READ-ONLY PATH (Frente 10) — previewForSessionPerson's contract ("read
  // WITHOUT writing anything", see that method's own comment) forbids the
  // bootstrap INSERT the write path performs above, so this never persists:
  // if the aggregate already exists it is trusted as-is; if it does not (in
  // practice this should not happen — a justification item cannot reach
  // under_review for a session that was never evaluated, which means
  // recalculateForSessionPerson — and therefore the write path — already ran
  // for it at least once — but defended anyway) it falls back to the same
  // rescan the write path would have bootstrapped from, simply never saving
  // the result.
  private async readAggregateCalculation(
    classGroupId: string,
    subjectId: string,
    personId: string,
    window: ReportingPeriodWindow,
  ): Promise<FrequencyCalculation> {
    const existing = await this.findAggregate(classGroupId, subjectId, personId, window);
    if (existing) {
      return this.toCalculation(existing.presentCount, existing.consideredCount);
    }
    const counts = await this.fullRescanCounts(classGroupId, subjectId, personId, window);
    return this.toCalculation(counts.presentCount, counts.consideredCount);
  }

  // Serializes readOrUpdateAggregate's whole check-then-act sequence for one
  // (tenant, person, class_group, subject, period) — see that method's own
  // comment for the race this closes. `pg_advisory_xact_lock` is
  // transaction-scoped: it releases automatically on commit or rollback, so
  // nothing here needs — or is allowed to — release it explicitly (doing so
  // manually would need a matching pg_advisory_unlock call outside this
  // service's transaction-per-request model, which invariant 1 in this
  // file's header already forbids opening). The key string mirrors
  // DeduplicationService's own correlation-key convention: every component
  // of this aggregate's real unique constraint
  // (tenant_id, person_id, class_group_id, subject_id, period_start_date,
  // period_end_date), joined so two different periods of the same person/
  // turma/matéria never collide into the same lock.
  private async lockAggregateIdentity(
    classGroupId: string,
    subjectId: string,
    personId: string,
    window: ReportingPeriodWindow,
  ): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const lockKey = [
      tenantId,
      personId,
      classGroupId,
      subjectId,
      window.startDate.toISOString(),
      window.endDate.toISOString(),
    ].join(':');

    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [lockKey]);
  }

  private async findAggregate(
    classGroupId: string,
    subjectId: string,
    personId: string,
    window: ReportingPeriodWindow,
  ): Promise<{ id: string; presentCount: number; consideredCount: number } | null> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows: Array<{ id: string; present_count: number | string; considered_count: number | string }> = await manager.query(
      `
      SELECT id, present_count, considered_count
      FROM attendance_frequency_period_aggregate
      WHERE tenant_id = $1
        AND person_id = $2
        AND class_group_id = $3
        AND subject_id = $4
        AND period_start_date = $5
        AND period_end_date = $6
      `,
      [tenantId, personId, classGroupId, subjectId, window.startDate, window.endDate],
    );

    const row = rows[0];
    return row
      ? { id: row.id, presentCount: Number(row.present_count), consideredCount: Number(row.considered_count) }
      : null;
  }

  // ON CONFLICT DO NOTHING + a fallback SELECT, not a try/catch around a
  // unique-violation error: this runs inside ordinary request-scoped code,
  // not a serialized job, so two different requests bootstrapping the SAME
  // (person, turma, matéria, período) at once is a real possibility — the
  // loser needs the row the winner just committed, not an exception.
  private async insertAggregate(
    classGroupId: string,
    subjectId: string,
    personId: string,
    window: ReportingPeriodWindow,
    counts: { presentCount: number; consideredCount: number },
  ): Promise<{ id: string; presentCount: number; consideredCount: number }> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const inserted: Array<{ id: string; present_count: number | string; considered_count: number | string }> = await manager.query(
      `
      INSERT INTO attendance_frequency_period_aggregate
        (id, tenant_id, person_id, class_group_id, subject_id, period_start_date, period_end_date, present_count, considered_count)
      VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (tenant_id, person_id, class_group_id, subject_id, period_start_date, period_end_date) DO NOTHING
      RETURNING id, present_count, considered_count
      `,
      [tenantId, personId, classGroupId, subjectId, window.startDate, window.endDate, counts.presentCount, counts.consideredCount],
    );

    if (inserted[0]) {
      const row = inserted[0];
      return { id: row.id, presentCount: Number(row.present_count), consideredCount: Number(row.considered_count) };
    }

    const existing = await this.findAggregate(classGroupId, subjectId, personId, window);
    if (!existing) {
      // Unreachable by construction: DO NOTHING only ever fires on exactly
      // the conflict this SELECT looks for.
      throw new Error('attendance_frequency_period_aggregate: insert conflicted but the conflicting row was not found');
    }
    return existing;
  }

  // A single atomic UPDATE, its arithmetic evaluated by Postgres against
  // whatever the row currently holds — never a read-modify-write in
  // application code, which would lose an update if two of this same
  // aggregate's transitions ever landed in overlapping transactions.
  private async applyAggregateDelta(
    aggregateId: string,
    presentDelta: number,
    consideredDelta: number,
  ): Promise<{ presentCount: number; consideredCount: number }> {
    const manager = this.tenantContext.getManager();

    // Testing Agent finding: TypeORM's Postgres driver returns a TUPLE,
    // `[rows, rowCount]`, for UPDATE/DELETE — never `rows` directly the way
    // it does for SELECT/INSERT (confirmed against
    // node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:198-206).
    // Destructuring `[rows]` here is load-bearing: reading `rows[0]` off the
    // undestructured tuple silently returns the whole inner rows array
    // instead of a row object, and `Number(row.present_count)` on that
    // becomes NaN — which used to reach AttendanceWarningService.classify,
    // always resolving to "no warning" and physically deleting any active
    // frequency warning on every incremental update after the first
    // bootstrap of a period (RULE-FREQ-03/04/07 violation, no exception
    // thrown). The write itself was always correct — Postgres ran the SQL's
    // arithmetic regardless — only the value THIS METHOD handed back was
    // wrong.
    const [rows]: [Array<{ present_count: number | string; considered_count: number | string }>, number] =
      await manager.query(
        `
      UPDATE attendance_frequency_period_aggregate
      SET present_count = present_count + $1,
          considered_count = considered_count + $2,
          updated_at = now()
      WHERE id = $3
      RETURNING present_count, considered_count
      `,
        [presentDelta, consideredDelta, aggregateId],
      );

    const row = rows[0];
    if (!row) {
      throw new Error(`attendance_frequency_period_aggregate ${aggregateId} not found while applying a delta`);
    }
    return { presentCount: Number(row.present_count), consideredCount: Number(row.considered_count) };
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
  //
  // FRENTE 10: this is no longer run on every recalculation — only to
  // BOOTSTRAP a period aggregate the first time it is computed for a person
  // (readOrUpdateAggregate), and, defensively, by previewForSessionPerson's
  // read-only fallback. That dependency on the whole window's history
  // surviving is exactly what RULE-RET-01's 60-day purge breaks for a period
  // longer than 60 days; the aggregate exists specifically so this query
  // only ever has to run once per (person, turma, matéria, período), early
  // enough in that period's life that the purge has not reached it yet.
  private async fullRescanCounts(
    classGroupId: string,
    subjectId: string,
    personId: string,
    window: ReportingPeriodWindow,
  ): Promise<{ presentCount: number; consideredCount: number }> {
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

    return {
      presentCount: Number(rows[0]?.present_count ?? 0),
      consideredCount: Number(rows[0]?.considered_count ?? 0),
    };
  }

  // Rounded here, in TypeScript, from the integer counts — Math.round
  // rounds .5 up, identically to Postgres' ROUND on numeric, so service and
  // database can never disagree about a boundary case (69,5 → 70).
  // RULE-FREQ-05.3: BOTH comparisons run on this rounded integer, which is
  // why it is also the value persisted on the warning row; the raw counts
  // travel with it so the UI can say "33 de 40 aulas".
  private toCalculation(presentCount: number, consideredCount: number): FrequencyCalculation {
    if (consideredCount === 0) {
      return { calculable: false, reason: 'no_definitive_sessions' };
    }
    return {
      calculable: true,
      presentCount,
      consideredCount,
      percentage: Math.round((presentCount * 100) / consideredCount),
    };
  }

  // Physical delete of EVERY attendance_frequency_period_aggregate row for
  // this turma (Frente 10) — mirrors AttendanceWarningService.
  // deleteWarningsForClassGroup exactly, for the same reason:
  // attendance_frequency_period_aggregate.class_group_id is a real FK to
  // class_group (flagged in the AddAttendanceRetention migration's own
  // header — "will block a turma's deletion unless that orchestrator also
  // deletes this table's rows"), so leaving even one row behind — the
  // turma passed RULE-INST-13's check with zero session_attendance_
  // consolidation/pending_review/checkin/interval rows, which does NOT
  // guarantee zero aggregate rows: reconcileForPerson's lazy bootstrap
  // (GET /v1/me/warnings) can create a 0/0 "no_definitive_sessions" row for
  // an enrolled student who has never had a session evaluated yet — would
  // fail ClassGroupDeletionOrchestrator's final DELETE on the constraint.
  // Takes the caller's manager because the only call site
  // (ClassGroupDeletionOrchestrator.deleteClassGroupUnchecked) already owns
  // its own unit of work — same "Unchecked" contract as invariant 2 in this
  // file's own header.
  async deleteAggregatesForClassGroup(manager: EntityManager, classGroupId: string): Promise<void> {
    await manager.query('DELETE FROM attendance_frequency_period_aggregate WHERE class_group_id = $1', [classGroupId]);
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
