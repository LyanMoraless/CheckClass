import { Injectable } from '@nestjs/common';
import { addUtcDays, utcMidnight } from '../../common/utc-date.util';
import { ClassGroupEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { currentPeriodWindow } from '../attendance-frequency/reporting-period.util';
import { ResolvedAttendanceConfig, TenantConfigService } from '../config/tenant-config.service';
import { ABSENCE_JUSTIFICATION_SUBMISSION_DEADLINE_DAYS } from './absence-justification.constants';

export interface EligibleSession {
  classSessionId: string;
  classGroupId: string;
  subjectId: string;
  scheduledStart: Date;
}

// RULE-JUST-14's six exclusion reasons, named for what they mean to a
// student reading them, not for the internal column value that produced
// them.
export type AbsenceJustificationExclusionReason =
  | 'session_cancelled'
  | 'not_evaluated_yet'
  | 'already_present'
  | 'pending_review'
  | 'already_justified'
  | 'already_under_review'
  | 'before_enrollment'
  | 'deadline_expired';

export interface ExcludedSession {
  classSessionId: string;
  scheduledStart: Date;
  reason: AbsenceJustificationExclusionReason;
}

export interface EligibilityResult {
  eligible: EligibleSession[];
  excluded: ExcludedSession[];
}

interface CandidateRow {
  class_session_id: string;
  class_group_id: string;
  subject_id: string;
  scheduled_start: string;
  session_status: string;
  consolidation_status: string | null;
  consolidation_created_at: string | null;
  resolved_at: string | null;
  enrollment_created_at: string;
  has_under_review_item: boolean;
}

// RULE-JUST-01 addendum/RULE-JUST-06/13/14/15/16: derives, from a student's
// date range, the concrete class_session rows that are eligible to become
// absence_justification_item rows. Never called with the eventual item
// insert already committed — AbsenceJustificationSubmissionService decides,
// from THIS result, whether to persist anything at all (RULE-JUST-14: zero
// eligible sessions refuses the whole request and the attachment is never
// stored).
@Injectable()
export class AbsenceJustificationEligibilityService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly tenantConfig: TenantConfigService,
  ) {}

  async deriveEligibleSessions(personId: string, startDate: Date, endDate: Date): Promise<EligibilityResult> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // THE QUERY IS DRIVEN BY class_group_enrollment -> class_group_subject ->
    // class_session, restricted to ACTIVE enrollments only (RULE-JUST-18.4:
    // "só matrícula active pode criar pedido" — a NEW item is a creation act,
    // unlike an already-queued item, which stays decidable regardless of a
    // later matrícula change).
    //
    // has_under_review_item is a correlated EXISTS against
    // absence_justification_item, scoped to THIS student's own rows — safe
    // to read here because app.person_id is already set to this same
    // personId by AbsenceJustificationPersonScopeInterceptor before this
    // method ever runs, so student_ownership RLS matches every row this
    // subquery could possibly touch.
    const rows: CandidateRow[] = await manager.query(
      `
      SELECT
        cs.id AS class_session_id,
        cs.class_group_id AS class_group_id,
        cs.subject_id AS subject_id,
        cs.scheduled_start AS scheduled_start,
        cs.status AS session_status,
        c.status AS consolidation_status,
        c.created_at AS consolidation_created_at,
        c.resolved_at AS resolved_at,
        cge.created_at AS enrollment_created_at,
        EXISTS (
          SELECT 1 FROM absence_justification_item i
          WHERE i.class_session_id = cs.id AND i.person_id = cge.person_id AND i.status = 'under_review'
        ) AS has_under_review_item
      FROM class_group_enrollment cge
      JOIN class_group_subject cgs
        ON cgs.tenant_id = cge.tenant_id AND cgs.class_group_id = cge.class_group_id
      JOIN class_session cs
        ON cs.tenant_id = cge.tenant_id AND cs.class_group_id = cgs.class_group_id AND cs.subject_id = cgs.subject_id
      LEFT JOIN session_attendance_consolidation c
        ON c.tenant_id = cs.tenant_id AND c.class_session_id = cs.id AND c.person_id = cge.person_id
      WHERE cge.tenant_id = $1
        AND cge.person_id = $2
        AND cge.role = 'student'
        AND cge.enrollment_status = 'active'
        AND cs.scheduled_start >= $3
        AND cs.scheduled_start < $4
      ORDER BY cs.scheduled_start ASC
      `,
      [tenantId, personId, startDate, addUtcDays(endDate, 1)],
    );

    const eligible: EligibleSession[] = [];
    const excluded: ExcludedSession[] = [];
    const contextCache = new Map<string, { classGroup: ClassGroupEntity; config: ResolvedAttendanceConfig }>();

    for (const row of rows) {
      const scheduledStart = new Date(row.scheduled_start);
      const exclude = (reason: AbsenceJustificationExclusionReason) => {
        excluded.push({ classSessionId: row.class_session_id, scheduledStart, reason });
      };

      // RULE-JUST-14 items 2/3: cancelled or pending sessions never become
      // items. Cancelled first, since a cancelled session has no meaningful
      // consolidation status to read.
      if (row.session_status === 'cancelled') {
        exclude('session_cancelled');
        continue;
      }
      if (!row.consolidation_status) {
        exclude('not_evaluated_yet');
        continue;
      }
      if (row.consolidation_status === 'present') {
        // RULE-JUST-14: a session the student actually attended is never
        // justifiable — the remedy for a wrong 'present' is chamada
        // correction (RULE-ATT-11/12), never this flow.
        exclude('already_present');
        continue;
      }
      if (row.consolidation_status === 'pending') {
        exclude('pending_review');
        continue;
      }
      if (row.consolidation_status === 'absent_justified') {
        // RULE-JUST-16.2: a session with an already-approved item is closed
        // to new ones — structurally readable off the consolidation status
        // itself, no second query needed.
        exclude('already_justified');
        continue;
      }
      // Every other value would violate the DB CHECK; only 'absent' reaches
      // here.
      if (row.has_under_review_item) {
        // RULE-JUST-16.1: at most one item under_review per session/aluno.
        exclude('already_under_review');
        continue;
      }

      const enrollmentCreatedAt = new Date(row.enrollment_created_at);
      if (scheduledStart.getTime() <= enrollmentCreatedAt.getTime()) {
        // RULE-JUST-14 item 4. "Início da matrícula" has no dedicated column
        // on class_group_enrollment — enrollment.createdAt is used as its
        // proxy (flagged in the Backend Implementation Summary; the rule
        // itself is confidence "média" on this exact point).
        exclude('before_enrollment');
        continue;
      }

      let context = contextCache.get(row.class_group_id);
      if (!context) {
        const classGroup = await manager.getRepository(ClassGroupEntity).findOneByOrFail({ id: row.class_group_id });
        const config = await this.tenantConfig.resolveEffectiveConfig(row.class_group_id);
        context = { classGroup, config };
        contextCache.set(row.class_group_id, context);
      }

      // RULE-JUST-15.1: the 15-day clock starts when the falta became
      // DEFINITIVE — resolved_at (pending-review resolution,
      // RULE-ATT-11/12) when set, otherwise created_at (the session was
      // consolidated straight to 'absent', no pending review ever
      // happened). No dedicated "became definitive" column exists on
      // session_attendance_consolidation — this is the same kind of proxy
      // as enrollment_created_at above, flagged in the same place.
      const definitiveAt = row.resolved_at ? new Date(row.resolved_at) : new Date(row.consolidation_created_at as string);
      const deadline = this.computeDeadline(definitiveAt, scheduledStart, context.classGroup, context.config);
      if (new Date().getTime() >= deadline.getTime()) {
        exclude('deadline_expired');
        continue;
      }

      eligible.push({
        classSessionId: row.class_session_id,
        classGroupId: row.class_group_id,
        subjectId: row.subject_id,
        scheduledStart,
      });
    }

    return { eligible, excluded };
  }

  // RULE-JUST-15.3: the earlier of (definitiveAt + 15 dias corridos) and the
  // closing of the session's own período de apuração — both expressed as
  // EXCLUSIVE upper bounds (the deadline itself is inclusive through
  // 23:59:59 of its last valid day, RULE-JUST-15.2).
  private computeDeadline(
    definitiveAt: Date,
    sessionScheduledStart: Date,
    classGroup: ClassGroupEntity,
    config: ResolvedAttendanceConfig,
  ): Date {
    const fifteenDayDeadline = addUtcDays(
      utcMidnight(definitiveAt),
      ABSENCE_JUSTIFICATION_SUBMISSION_DEADLINE_DAYS + 1,
    );

    const window = currentPeriodWindow(
      classGroup.termStartDate,
      classGroup.termEndDate,
      config.accumulatedFrequencyPeriod,
      sessionScheduledStart,
    );
    if (!window) {
      // No período de apuração to close (turma with no term dates) — only
      // the 15-day clock applies.
      return fifteenDayDeadline;
    }

    // window.endDate is already clamped to class_group.term_end_date
    // (reporting-period.util.ts), so this single bound also covers
    // RULE-JUST-15.3's third condition ("fim do período letivo da turma").
    const periodCloseDeadline = addUtcDays(window.endDate, 1);
    return fifteenDayDeadline.getTime() < periodCloseDeadline.getTime() ? fifteenDayDeadline : periodCloseDeadline;
  }
}
