import { Injectable } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { utcMidnight } from '../../common/utc-date.util';
import { AttendanceFrequencyWarningEntity, ClassGroupEnrollmentEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
// TYPE-ONLY ON PURPOSE. attendance-frequency-engine.service.ts imports this
// file for its constructor dependency, so a value import back would close a
// require() cycle at runtime. TypeScript erases a type-only import entirely,
// so the module graph stays strictly one-directional (engine → warning
// service) while the discriminated union keeps living next to the query that
// produces it, where its `calculable: false` branches are decided.
import type { FrequencyCalculation } from './attendance-frequency-engine.service';
import { FREQUENCY_WARNING_MARGIN_POINTS } from './frequency-warning.constants';
import { ReportingPeriodWindow, sameWindow } from './reporting-period.util';

// The engine's call site (recalculate()) defines this shape — it is written
// down here, not there, because the engine deliberately hands over EVERYTHING
// the decision needs (the raw calculation, the window it was measured in, and
// the minimum in force) and then stops caring what is done with it.
export interface ApplyCalculationInput {
  personId: string;
  classGroupId: string;
  subjectId: string;
  // Null carries the same meaning as `calculation.reason === 'no_period_window'`
  // — the engine derives one from the other, they are never inconsistent.
  window: ReportingPeriodWindow | null;
  minPercentage: number;
  calculation: FrequencyCalculation;
}

// The two disjoint halves of the risk band (RULE-FREQ-03 / RULE-FREQ-07),
// mirroring attendance_frequency_warning_type_check.
type WarningType = 'approaching_minimum' | 'below_minimum';

// The only branch of the engine's discriminated union that carries a
// percentage. Naming it keeps the narrowing done once, at the freeze check,
// instead of every private helper re-testing `calculable` (and inventing a
// fallback number for a case that cannot happen).
type CalculableFrequency = Extract<FrequencyCalculation, { calculable: true }>;

// Everything a warning restates on every recalculation, whether it is being
// inserted or refreshed — computed once per call and passed down, so the
// insert and the two update paths can never drift apart on what they write.
interface WarningNumbers {
  frequencyPercentage: number;
  presentCount: number;
  consideredCount: number;
  minPercentageApplied: number;
  periodStartDate: Date;
  periodEndDate: Date;
}

// Closed vocabulary of attendance_frequency_warning_resolution_reason_check.
// "The frequency went back up" is absent on purpose: that outcome is a
// physical DELETE (RULE-FREQ-04 addendum a) and never produces a reason.
type ResolutionReason = 'subject_removed_from_class_group' | 'period_closed' | 'enrollment_inactive';

const ACTIVE_WARNING_STATUS = 'active';
const RESOLVED_WARNING_STATUS = 'resolved';

// RULE-INST-11's vocabulary (class-group-enrollment.entity.ts:
// active | on_leave | graduated | withdrawn). Declared locally rather than
// imported from the exam module's exam-vocabulary.ts, which holds the same
// literal: sharing a one-word constant across two unrelated bounded contexts
// would couple them for nothing.
const ACTIVE_ENROLLMENT_STATUS = 'active';

// The decision half of Controle B (RULE-FREQ-03/04/07/08): the engine says
// WHAT the accumulated frequency is, this service says whether the student
// gets a warning about it and what happens to the one they may already have.
//
// Everything below operates on the AT MOST ONE active row per
// (tenant, person, class_group, subject) that the partial unique index
// attendance_frequency_warning_one_active_per_subject guarantees. That index
// is not a safety net here, it is the premise: "one warning at a time per
// matéria" (RULE-FREQ-07) is why a type transition is an UPDATE of the same
// row and never a second insert.
//
// Same transaction invariants as the engine: this service NEVER opens a
// transaction and never uses a manager other than
// this.tenantContext.getManager(), because `SET LOCAL app.tenant_id` (and
// therefore RLS) is transaction-scoped. The two exceptions —
// closeWarningsForClassGroupSubject and deleteWarningsForClassGroup — take an
// EntityManager because their callers are the "Unchecked" deletion primitives
// that already own a unit of work; that parameter means "you are inside
// someone else's transaction", never "escape the tenant context". See
// invariant 2 in attendance-frequency-engine.service.ts.
@Injectable()
export class AttendanceWarningService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async applyCalculation(input: ApplyCalculationInput): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(AttendanceFrequencyWarningEntity);

    const activeWarning = await repository.findOneBy({
      personId: input.personId,
      classGroupId: input.classGroupId,
      subjectId: input.subjectId,
      status: ACTIVE_WARNING_STATUS,
    });

    // ENROLLMENT GATE (RULE-FREQ-08.2), and it runs FIRST, before the
    // calculability check below — deliberately, not by accident of ordering.
    // The engine is agnostic to enrollment_status by design (its comment says
    // so): frequency stays calculable for on_leave/graduated/withdrawn, the
    // number is never hidden or erased. Only warning GENERATION stops, and
    // that is this service's call alone.
    //
    // Ordering matters because the two branches disagree about the same row:
    // "not calculable" freezes it, "enrollment no longer active" closes it.
    // RULE-FREQ-08.2 requires the close to happen when the matrícula stops
    // being active, full stop — it does not make that conditional on the
    // matéria still having computable data. A trancado student whose matéria
    // also went quiet must not keep an active warning alive on the freeze
    // branch, so the gate is evaluated first.
    //
    // A person with no enrollment row at all lands here too: no active
    // enrollment, no warning. RULE-FREQ-08.2's addendum makes the close
    // terminal — nothing here ever revives a resolved row if the matrícula
    // comes back to active; the ordinary recalculation writes a NEW warning
    // if the current frequency still deserves one.
    if (!(await this.hasActiveEnrollment(manager, input.personId, input.classGroupId))) {
      if (activeWarning) {
        await this.resolveWarning(repository, activeWarning.id, 'enrollment_inactive');
      }
      return;
    }

    // FREEZE (approved answer 6). No `else`, no delete, no resolve, no
    // number refresh — this reads like a missing branch, so: a matéria that
    // TEMPORARILY has nothing to compute (turma without term dates, or a
    // reporting period that has not produced a single definitive session yet)
    // must not retract a warning the student has already seen. Deleting would
    // apply the "the frequency went back up" semantics (RULE-FREQ-04 addendum
    // a) to a case where nothing went up, and resolving would announce an
    // outcome that did not happen. The row keeps its last known percentage
    // until real data replaces it.
    const calculation = input.calculation;
    if (!calculation.calculable) {
      return;
    }

    const window = input.window;
    if (!window) {
      // Unreachable by construction — the engine only ever returns
      // `calculable: true` from inside a non-null window, and produces
      // `no_period_window` otherwise. Kept as the narrowing that lets the
      // period dates below be written without a non-null assertion, which
      // would hide exactly this coupling instead of stating it.
      return;
    }

    const warningType = this.classify(calculation.percentage, input.minPercentage);
    const numbers = this.warningNumbers(calculation, input.minPercentage, window);
    const currentWarning = await this.closeIfPeriodTurnedOver(repository, activeWarning, window);

    if (!warningType) {
      // THE ONLY PHYSICAL DELETE of a warning in the system (RULE-FREQ-04
      // addendum a): the frequency climbed back above min + margin, and the
      // business asked for the warning to vanish "as if it had never been
      // issued" — no resolution_reason, no history row, nothing left for the
      // student to find. Every other ending is a `resolved` row.
      if (currentWarning) {
        await repository.delete({ id: currentWarning.id });
      }
      return;
    }

    if (!currentWarning) {
      await this.insertWarning(repository, input, numbers, warningType);
      return;
    }

    if (currentWarning.warningType === warningType) {
      // Same warning, new numbers. warningTypeSince and seenAt are NOT
      // touched: the student has already seen this warning and nothing
      // qualitatively changed — re-notifying them because 68% became 67%
      // would turn the alert into noise.
      await repository.update({ id: currentWarning.id }, numbers);
      return;
    }

    // Type transition, in place (RULE-FREQ-04 item 1). Crossing below the
    // minimum is a different, more serious statement than approaching it, so
    // the student must be notified again: warningTypeSince restarts and
    // seenAt goes back to NULL. Still the same row — the partial unique index
    // would reject a second active one anyway, and RULE-FREQ-07 forbids
    // showing both types for one matéria.
    await repository.update(
      { id: currentWarning.id },
      { ...numbers, warningType, warningTypeSince: new Date(), seenAt: null },
    );
  }

  // RULE-FREQ-04 addendum c: removing a matéria from a turma ENDS its
  // warnings as resolved — a different outcome from "the frequency went back
  // up", which deletes. Takes the caller's manager because the only call site
  // is ClassGroupDeletionOrchestrator.removeSubjectFromClassGroup, which owns
  // its own unit of work.
  async closeWarningsForClassGroupSubject(
    manager: EntityManager,
    classGroupId: string,
    subjectId: string,
  ): Promise<void> {
    await manager
      .getRepository(AttendanceFrequencyWarningEntity)
      .update(
        { classGroupId, subjectId, status: ACTIVE_WARNING_STATUS },
        { status: RESOLVED_WARNING_STATUS, resolvedAt: new Date(), resolutionReason: 'subject_removed_from_class_group' },
      );
  }

  // Physical delete of EVERY row of the turma, whatever its status —
  // including already-resolved ones, which a status filter would leave behind
  // to block the FK. The turma ceased to exist (RULE-INST-08: this schema has
  // no soft delete), so there is nothing for a resolved warning to be a fact
  // about anymore.
  async deleteWarningsForClassGroup(manager: EntityManager, classGroupId: string): Promise<void> {
    await manager.getRepository(AttendanceFrequencyWarningEntity).delete({ classGroupId });
  }

  // RULE-FREQ-05.3: BOTH borders are inclusive and BOTH comparisons run on
  // the rounded integer the engine already produced — never on the raw ratio.
  // The two ranges are disjoint by construction (p < min, then min <= p <=
  // min + margin), which is what lets warning_type stay out of the uniqueness
  // key. `null` means the student is comfortably above the band and deserves
  // no warning at all.
  private classify(percentage: number, minPercentage: number): WarningType | null {
    if (percentage < minPercentage) {
      return 'below_minimum';
    }
    if (percentage <= minPercentage + FREQUENCY_WARNING_MARGIN_POINTS) {
      return 'approaching_minimum';
    }
    return null;
  }

  // RULE-FREQ-08.1: a warning is always a fact ABOUT ONE reporting period. On
  // period turnover the previous period's row is closed explicitly as
  // `period_closed` — it must not silently disappear (that would tell the
  // student their frequency recovered, which is false) and must not carry an
  // elapsed period's percentage into the new one. The new period starts clean
  // and gets its own row only if its own calculation justifies it.
  //
  // ORDERING CONSTRAINT: this close has to reach the database BEFORE the
  // insert that may follow it, or both rows are momentarily `active` and the
  // partial unique index fires. TypeORM's update() issues its UPDATE
  // immediately (there is no deferred unit of work to flush here), so
  // awaiting it in sequence is the whole mechanism — do not "optimize" this
  // into a Promise.all with whatever comes next.
  private async closeIfPeriodTurnedOver(
    repository: Repository<AttendanceFrequencyWarningEntity>,
    activeWarning: AttendanceFrequencyWarningEntity | null,
    window: ReportingPeriodWindow,
  ): Promise<AttendanceFrequencyWarningEntity | null> {
    if (!activeWarning || sameWindow(this.storedWindow(activeWarning), window)) {
      return activeWarning;
    }

    await this.resolveWarning(repository, activeWarning.id, 'period_closed');
    return null;
  }

  private async insertWarning(
    repository: Repository<AttendanceFrequencyWarningEntity>,
    input: ApplyCalculationInput,
    numbers: WarningNumbers,
    warningType: WarningType,
  ): Promise<void> {
    await repository.save(
      repository.create({
        tenantId: this.tenantContext.getTenantId(),
        personId: input.personId,
        classGroupId: input.classGroupId,
        subjectId: input.subjectId,
        warningType,
        warningTypeSince: new Date(),
        ...numbers,
        status: ACTIVE_WARNING_STATUS,
        resolvedAt: null,
        resolutionReason: null,
        // Never seen yet — GET /v1/me/warnings stamps this on first read
        // (RULE-FREQ-04 item 1, "first access after being generated").
        seenAt: null,
      }),
    );
  }

  // The period dates travel with the numbers because a row that survives an
  // edited term (same slice index, moved boundaries) has to describe the
  // window it was actually measured over, not the one it was first written
  // with.
  //
  // minPercentageApplied is written here for EXPLAINABILITY ONLY — it records
  // the minimum in force at this write so an old warning stays readable if
  // the configuration changes. It is never read back as a configuration
  // source: Controle B always resolves the effective config live (RULE-FREQ-02
  // addendum), which is the deliberate divergence from Controle A's snapshot
  // behavior documented in tenant-config.service.ts.
  private warningNumbers(
    calculation: CalculableFrequency,
    minPercentage: number,
    window: ReportingPeriodWindow,
  ): WarningNumbers {
    return {
      // The ROUNDED integer the engine already decided on (RULE-FREQ-05.3) —
      // the value the system acted on, not a second, rawer truth.
      frequencyPercentage: calculation.percentage,
      presentCount: calculation.presentCount,
      consideredCount: calculation.consideredCount,
      minPercentageApplied: minPercentage,
      periodStartDate: window.startDate,
      periodEndDate: window.endDate,
    };
  }

  private async resolveWarning(
    repository: Repository<AttendanceFrequencyWarningEntity>,
    warningId: string,
    reason: ResolutionReason,
  ): Promise<void> {
    // status/resolvedAt/resolutionReason move together or not at all —
    // attendance_frequency_warning_resolution_check rejects any partial
    // combination, so this trio is written in one statement everywhere.
    await repository.update(
      { id: warningId },
      { status: RESOLVED_WARNING_STATUS, resolvedAt: new Date(), resolutionReason: reason },
    );
  }

  // The window the stored row was written against, rebuilt so sameWindow()
  // can compare it against the live one. The `new Date(...)` is not
  // redundant: period_start_date/period_end_date are `date` columns, and this
  // normalizes whatever shape the driver hands back into the UTC-midnight
  // date-only convention utc-date.util.ts defines for the whole project —
  // the same convention class_group.term_start_date/term_end_date already
  // follow, which is what the live window was sliced from.
  private storedWindow(warning: AttendanceFrequencyWarningEntity): ReportingPeriodWindow {
    return {
      startDate: utcMidnight(new Date(warning.periodStartDate)),
      endDate: utcMidnight(new Date(warning.periodEndDate)),
    };
  }

  // RULE-FREQ-08.2 reads enrollment_status only — no role filter, matching
  // the precedent in ExamAvailabilityService.hasActiveEnrollment. A
  // non-student enrollment cannot reach this point with data anyway: the
  // Controle A engine only ever consolidates role='student' rosters, so any
  // other role resolves as `no_definitive_sessions` and never gets past the
  // freeze branch.
  private async hasActiveEnrollment(manager: EntityManager, personId: string, classGroupId: string): Promise<boolean> {
    const count = await manager.getRepository(ClassGroupEnrollmentEntity).count({
      where: { personId, classGroupId, enrollmentStatus: ACTIVE_ENROLLMENT_STATUS },
    });
    return count > 0;
  }
}
