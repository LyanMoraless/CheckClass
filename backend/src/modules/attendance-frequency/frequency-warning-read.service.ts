import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { dateKeyOfUtc } from '../../common/utc-date.util';
import { AttendanceFrequencyWarningEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { AttendanceFrequencyEngineService } from './attendance-frequency-engine.service';

// One active warning as the student's home renders it. Everything the "área
// de avisos" needs is here on purpose (RULE-FREQ-04 item 2): the UI must be
// able to write "33 de 40 aulas" and name the matéria without a second
// round-trip, so the raw counts and the joined names travel with the
// percentage instead of being fetched per row.
export interface ActiveWarningEntry {
  id: string;
  classGroupId: string;
  classGroupName: string;
  subjectId: string;
  subjectName: string;
  // approaching_minimum | below_minimum (RULE-FREQ-03/07). Kept as the raw
  // string the column holds — the two values ARE the contract, and narrowing
  // them to a union here would duplicate the vocabulary that
  // AttendanceWarningService and the DB CHECK already own.
  warningType: string;
  warningTypeSince: Date;
  frequencyPercentage: number;
  presentCount: number;
  consideredCount: number;
  minPercentageApplied: number;
  // Date-only strings, not Date — see the mapping comment below.
  periodStartDate: string;
  periodEndDate: string;
  // The value BEFORE this read stamped it (see stampFirstRead below): null
  // means "the student is seeing this warning for the very first time", which
  // is what RULE-FREQ-04 item 1's first-access notification is driven by.
  seenAt: Date | null;
}

// Shape of the raw query below. Two columns arrive as strings and are
// converted in one place:
//   - min_percentage_applied is `numeric`, and node-pg deliberately hands
//     numeric back as a string to avoid silent float precision loss.
//     frequency_percentage (smallint) and the two counts (int) do NOT need
//     this — the driver parses those as JS numbers already, so converting
//     them too would be cargo cult.
//   - the two period dates are read through to_char (see below).
interface ActiveWarningRow {
  id: string;
  classGroupId: string;
  classGroupName: string;
  subjectId: string;
  subjectName: string;
  warningType: string;
  warningTypeSince: Date;
  frequencyPercentage: number;
  presentCount: number;
  consideredCount: number;
  minPercentageApplied: string;
  periodStartDate: string;
  periodEndDate: string;
  seenAt: Date | null;
}

// The read model of Controle B — GET /v1/me/warnings' only data source
// (RULE-FREQ-04 items 2 and 4, RULE-FREQ-08.3).
//
// WHY IT LIVES IN attendance-frequency/ AND NOT IN self-service/: the two
// existing idioms in this codebase disagree, so the choice is stated rather
// than left to reading order. MyScheduleService/TeachingClassGroupsService
// own their query inside self-service/ because there is no domain module
// behind them; MeClassGroupAttendanceService instead sits in self-service/
// and DELEGATES to AttendanceRegisterService, the module that owns the data.
// This service is the second shape: attendance_frequency_warning is Controle
// B's own table, the lazy reconciliation below is Controle B's own engine,
// and the display filter is a Controle B business rule — none of that is
// self-service knowledge. self-service/ keeps only the route and delegates,
// exactly as it already does for the register.
//
// Same transaction invariants as the rest of this module: no transaction is
// opened here and no manager other than this.tenantContext.getManager() is
// ever used, because `SET LOCAL app.tenant_id` — and therefore RLS — is
// transaction-scoped to the one transaction TenantContextService.runWithTenant
// already wrapped the request in.
@Injectable()
export class FrequencyWarningReadService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly engine: AttendanceFrequencyEngineService,
  ) {}

  async listActiveWarningsForPerson(personId: string): Promise<ActiveWarningEntry[]> {
    // LAZY RECONCILIATION, BEFORE THE READ. Yes, a GET writes — deliberately,
    // and it is the load-bearing half of this endpoint, not an optimization.
    //
    // There is NO scheduler, NO cron, NO queue and NO batch job in this
    // project, and none is being added (architecture-overview.md, Frente 06,
    // section D, option 2 — options 1 and 3 were rejected there). The write
    // triggers of Controle B all hang off "a session became definitive", so
    // four sources of staleness have no event of their own to hang off:
    //   - period turnover (RULE-FREQ-08.1) — a date passes, nothing happens;
    //   - a changed attendance configuration, which RULE-FREQ-02's addendum
    //     requires to apply to the CURRENT period immediately (Controle B
    //     resolves config live, never by snapshot);
    //   - an edited term (term_start_date/term_end_date moved, so the slice
    //     boundaries moved with them);
    //   - a late enrollment (RULE-FREQ-05.4), whose denominator counts
    //     sessions that were consolidated before the student existed here.
    // The student opening the screen IS the trigger. And it is observably
    // complete: the warning is EXCLUSIVE to the student (RULE-FREQ-04
    // addendum b — no professor, no coordenador, no other endpoint reads
    // it), so a value recomputed on every read of its only reader is, by any
    // observation anyone can make, always current.
    //
    // Idempotent when nothing changed: the engine only writes on a real
    // delta (insert / number refresh / type transition / close / delete), so
    // a read that finds no change issues no write at all. Polling this
    // endpoint every 60s therefore costs the aggregation queries and nothing
    // more.
    await this.engine.reconcileForPerson(personId);

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // THREE THINGS IN THE QUERY BELOW ARE DECISIONS, NOT PHRASING. They are
    // written here rather than as SQL comments only because the reasoning
    // needs backticks and this is a template literal:
    //
    // 1. `status = 'active'` ONLY. A resolved row is retained history
    //    (period_closed, enrollment_inactive,
    //    subject_removed_from_class_group) and is not part of the student's
    //    avisos area. The fourth outcome, "the frequency went back up", is
    //    not even here to be filtered out — it was physically deleted
    //    (RULE-FREQ-04 addendum a).
    //
    // 2. DISPLAY FILTER on term_end_date (RULE-FREQ-08.3): a turma whose
    //    letivo period has already ended stops nagging the student —
    //    otherwise a warning from a semester that closed a year ago would sit
    //    on the home forever. It hides the row from THIS response and does
    //    nothing else: no resolve, no delete, and no seen_at stamp can reach
    //    a hidden row, since only the ids this query returns are stamped
    //    below. The data stays recorded, and "turma finalizada" still does
    //    not exist as a concept in this schema.
    //
    //    `term_end_date IS NULL` IS DELIBERATELY NOT HIDDEN, AND MUST NOT BE
    //    "FIXED". Replacing the predicate with COALESCE(cg.term_end_date, …)
    //    or adding `IS NOT NULL` would be a bug, not a tidy-up, on two
    //    counts. Business: RULE-FREQ-08 addendum 3 is explicit that only a
    //    date that is FILLED IN AND ALREADY PAST hides a warning, because an
    //    incomplete cadastro must never suppress a risk-of-reprovação alert —
    //    an administrator blanking a field would otherwise make a warning
    //    silently disappear. Mechanical: a turma with no term dates resolves
    //    as `no_period_window` and therefore cannot produce a warning at all,
    //    so any row reaching this branch was FROZEN (approved answer 6) from
    //    a time when the dates did exist — real, unresolved information about
    //    the student.
    //
    // 3. The two `date` columns are rendered by Postgres via to_char, not
    //    parsed by the driver. node-pg turns a `date` into a JS Date at LOCAL
    //    midnight, which for any process not running TZ=UTC serializes over
    //    JSON as the PREVIOUS day — a reporting period that visibly starts a
    //    day early. These boundaries are calendar facts, not instants.
    //    Rejected: returning the driver's Date and leaning on the
    //    project-wide TZ=UTC assumption documented in utc-date.util.ts — that
    //    assumption is sound for computation, but this value is rendered
    //    verbatim by the UI. warning_type_since and seen_at ARE instants and
    //    stay timestamptz.
    const rows: ActiveWarningRow[] = await manager.query(
      `
      SELECT
        w.id AS "id",
        w.class_group_id AS "classGroupId",
        cg.name AS "classGroupName",
        w.subject_id AS "subjectId",
        s.name AS "subjectName",
        w.warning_type AS "warningType",
        w.warning_type_since AS "warningTypeSince",
        w.frequency_percentage AS "frequencyPercentage",
        w.present_count AS "presentCount",
        w.considered_count AS "consideredCount",
        w.min_percentage_applied AS "minPercentageApplied",
        -- Date-only, rendered by Postgres (decision 3 above).
        to_char(w.period_start_date, 'YYYY-MM-DD') AS "periodStartDate",
        to_char(w.period_end_date, 'YYYY-MM-DD') AS "periodEndDate",
        w.seen_at AS "seenAt"
      FROM attendance_frequency_warning w
      JOIN class_group cg ON cg.id = w.class_group_id
      JOIN subject s ON s.id = w.subject_id
      WHERE w.tenant_id = $1
        AND w.person_id = $2
        -- Active warnings only (decision 1 above).
        AND w.status = 'active'
        -- Display filter, and the NULL branch is deliberate (decision 2
        -- above -- do not add COALESCE or IS NOT NULL here).
        AND (cg.term_end_date IS NULL OR cg.term_end_date >= $3::date)
      -- Stable alphabetical order, matching TeachingClassGroupsService's
      -- precedent. Rejected: ordering below_minimum ahead of
      -- approaching_minimum -- how to rank severity on screen is a
      -- presentation choice, and the response already carries warningType for
      -- the UI to make it.
      ORDER BY cg.name ASC, s.name ASC
      `,
      [
        tenantId,
        personId,
        // Date-only, so the comparison is a pure calendar comparison against
        // the `date` column and never depends on the database session's
        // timezone. "Already passed" excludes today: a warning stays visible
        // through the last day of the term.
        dateKeyOfUtc(new Date()),
      ],
    );

    const entries = rows.map((row) => this.toEntry(row));

    // WRITE AFTER THE RESPONSE IS BUILT, never before (RULE-FREQ-04 item 1).
    // The entries above still carry the PRE-UPDATE seenAt, which is the only
    // way the client can tell a first-ever view (null) from a repeat view —
    // that distinction is exactly what drives the first-access notification.
    // Stamping first and reading back would make every warning look already
    // seen and the notification would never fire once.
    await this.stampFirstRead(rows.filter((row) => row.seenAt === null).map((row) => row.id));

    return entries;
  }

  // RULE-FREQ-04 item 1, "primeiro acesso do aluno ao sistema após ser
  // gerado": seen_at is stamped on the first read that actually SHOWED the
  // warning. Only the ids just returned are touched — a row hidden by the
  // display filter was not shown, so it keeps seen_at NULL and would be
  // announced properly if it ever becomes visible again.
  //
  // Rows that already have a seen_at are left alone: it records the first
  // sighting, not the latest. AttendanceWarningService is the only other
  // writer, and it resets this to NULL on a warning_type transition so a
  // student crossing below the minimum is notified again.
  private async stampFirstRead(warningIds: string[]): Promise<void> {
    if (warningIds.length === 0) {
      return;
    }

    await this.tenantContext
      .getManager()
      .getRepository(AttendanceFrequencyWarningEntity)
      .update({ id: In(warningIds) }, { seenAt: new Date() });
  }

  private toEntry(row: ActiveWarningRow): ActiveWarningEntry {
    return {
      ...row,
      // The single string→number conversion this row needs (see
      // ActiveWarningRow). minPercentageApplied is here for explainability
      // only — it says which minimum was in force when the row was last
      // written, so an old warning stays readable after a configuration
      // change; it is never a configuration source.
      minPercentageApplied: Number(row.minPercentageApplied),
    };
  }
}
