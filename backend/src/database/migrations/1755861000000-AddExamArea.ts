import { MigrationInterface, QueryRunner } from 'typeorm';

// Área de Provas (Exam Area) — the 9 tables of the data model approved on
// 2026-09-02 (architecture-overview.md, "Modelagem de dados — Área de
// Provas"), implementing RULE-EXAM-01..17 (business-rules/references/
// exam-rules.md). Nothing here is new modeling: table names, the snapshot
// requirement, the append-only audit trail and the RLS reinforcements were
// all fixed by that decision plus the Security review attached to it.
//
// Cross-cutting notes that apply to every table below:
//   - tenant_id + its own RLS policy on all 9 tables (RULE-TEN-01), never
//     "inherited" through a FK: exam_question_option and
//     exam_answer_selected_option get real policies of their own because a
//     policy on the parent table does not constrain reads of the child.
//   - exam_session / exam_answer / exam_answer_selected_option /
//     exam_session_event additionally carry an OWNERSHIP predicate by
//     person_id (Security reinforcement): two students of the same tenant
//     must not be able to see each other's session, answers or violation
//     trail, and tenant_id alone cannot express that.
//   - RULE-EXAM-17 (student never sees is_correct/points) is NOT enforced
//     here — it is a DTO allow-list concern in the application layer. The
//     columns exist, the payload must exclude them.
//
// IMPORTANT for the Backend Agent — these tables are fail-closed. The
// ownership policies read two GUCs that TenantContextService does not set
// today (it only sets app.tenant_id):
//   - app.person_id             — the authenticated person, set on every
//                                 student-scoped exam request;
//   - app.exam_management_scope — 'on' only after LeadershipScopeService
//                                 has already authorized the request as
//                                 teacher/coordinator/direction management
//                                 or audit access (RULE-EXAM-16). The GUC
//                                 is a marker that authorization happened,
//                                 not the authorization itself.
// With neither GUC set, these four tables return zero rows and reject
// writes — by design, so a missing context is a visible failure instead of
// a silent cross-student leak.
export class AddExamArea1755861000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    // RULE-EXAM-16: every exam belongs to one class_group — student
    // eligibility (active enrollment) and management/audit authorization
    // both derive from that link, so it is NOT NULL.
    //
    // available_from/available_until are the availability window of
    // RULE-EXAM-06 ("when the student may start"), while duration_minutes
    // is the individual allowance counted from each student's own start.
    // They are deliberately independent columns: NULL duration = no time
    // limit, which is not the same as "until the window closes".
    //
    // created_by_person_id is authorship metadata only — authorization is
    // never derived from it (RULE-EXAM-16 routes that through the class
    // group and LeadershipScopeService).
    //
    // status DRAFT -> PUBLISHED (confirmed by the user 2026-09-03, closing
    // the "sem estado de rascunho/publicação" assumption the Business Analyst
    // had registered but never had confirmed). An exam is invisible to
    // students until the teacher publishes it explicitly — opening the
    // availability window is NOT what exposes it.
    //
    // Why this earns a column instead of being left to the teacher's care
    // with available_from: a student who opens a half-built exam has already
    // burned the single attempt they get (UNIQUE on exam_session below), so
    // the mistake is unrecoverable rather than merely annoying. The window is
    // about WHEN the exam is takeable; status is about WHETHER it is ready to
    // be taken at all. Two separate questions, so two separate columns.
    //
    // published_at is kept in lockstep with status by a CHECK rather than
    // left as loose metadata — a PUBLISHED exam without a publication
    // timestamp (or the reverse) would be a silent audit gap on graded
    // material.
    await queryRunner.query(`
      CREATE TABLE exam (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        created_by_person_id uuid NOT NULL REFERENCES person(id),
        title varchar(255) NOT NULL,
        description text,
        status varchar(20) NOT NULL DEFAULT 'DRAFT',
        published_at timestamptz,
        available_from timestamptz NOT NULL,
        available_until timestamptz NOT NULL,
        duration_minutes int,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_status_check CHECK (status IN ('DRAFT', 'PUBLISHED')),
        CONSTRAINT exam_published_at_check CHECK ((status = 'PUBLISHED') = (published_at IS NOT NULL)),
        CONSTRAINT exam_availability_window_check CHECK (available_until > available_from),
        CONSTRAINT exam_duration_minutes_check CHECK (duration_minutes IS NULL OR duration_minutes > 0)
      )
    `);

    // Student's "which exams are open for my class group now" and the
    // teacher's exam list for a class group — both filter by class group
    // and order/filter by the window.
    await queryRunner.query(`
      CREATE INDEX exam_class_group_window_idx ON exam (tenant_id, class_group_id, available_from)
    `);

    // RULE-EXAM-03, definitive set of question types: multiple choice (one
    // correct), checkboxes (several correct), short answer, paragraph.
    //
    // points = how much the question is worth at most, for EVERY type — the
    // open item the approved data model left for this implementation. One
    // single "how much it is worth" concept, two grading paths: objective
    // types are corrected automatically against the answer key
    // (exam_question_option.is_correct, RULE-EXAM-14) up to this value,
    // subjective types get a value manually assigned by the teacher up to
    // this same maximum. NULL = the question carries no score at all, which
    // is what makes RULE-EXAM-14's "exam with no answer key behaves like a
    // plain form" possible.
    //
    // There is deliberately NO is_required/mandatory column: every question
    // is optional (confirmed 2026-09-03) — leaving a question blank is
    // allowed and simply scores zero.
    //
    // position is not UNIQUE per exam on purpose: reordering questions
    // would need a deferrable constraint for no real gain, and ordering is
    // a presentation concern (ties broken by id).
    await queryRunner.query(`
      CREATE TABLE exam_question (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_id uuid NOT NULL REFERENCES exam(id),
        question_type varchar(20) NOT NULL,
        prompt text NOT NULL,
        position int NOT NULL,
        points numeric(6, 2),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_question_type_check
          CHECK (question_type IN ('MULTIPLE_CHOICE', 'CHECKBOXES', 'SHORT_ANSWER', 'PARAGRAPH')),
        CONSTRAINT exam_question_points_check CHECK (points IS NULL OR points >= 0),
        CONSTRAINT exam_question_position_check CHECK (position >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX exam_question_exam_position_idx ON exam_question (exam_id, position)
    `);

    // Only objective questions (MULTIPLE_CHOICE / CHECKBOXES) have options;
    // that cross-table rule is validated in the application layer rather
    // than by a trigger — a trigger would be the only way to express it in
    // SQL and the approved model does not justify one here.
    //
    // is_correct is the answer key of RULE-EXAM-14. It lives on the option
    // row (not on the question) because CHECKBOXES has several correct
    // options. Never serve this column to a student (RULE-EXAM-17).
    await queryRunner.query(`
      CREATE TABLE exam_question_option (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_question_id uuid NOT NULL REFERENCES exam_question(id),
        label text NOT NULL,
        position int NOT NULL,
        is_correct boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_question_option_position_check CHECK (position >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX exam_question_option_question_position_idx
      ON exam_question_option (exam_question_id, position)
    `);

    // RULE-EXAM-04: the proctoring reaction mode, one row per exam.
    // TERMINATE = end the session on a violation; LOG_ONLY = record and let
    // the student continue. No DEFAULT: RULE-EXAM-13 requires the teacher
    // to choose it explicitly when configuring the exam.
    await queryRunner.query(`
      CREATE TABLE exam_monitoring_config (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_id uuid NOT NULL REFERENCES exam(id),
        monitoring_mode varchar(20) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_monitoring_config_exam_unique UNIQUE (exam_id),
        CONSTRAINT exam_monitoring_config_mode_check
          CHECK (monitoring_mode IN ('TERMINATE', 'LOG_ONLY'))
      )
    `);

    // RULE-EXAM-05: which event types are monitored in this exam — one row
    // per enabled type (the checkbox list of RULE-EXAM-13). This is a
    // per-exam enablement list, not a global catalog: exam_session_event
    // stores its event_type as free text and does not reference this table,
    // so no shared reference table is needed.
    //
    // Constrained by CHECK on purpose, unlike exam_session_event's free
    // text column: this is the allow-list of what a client may ask to have
    // monitored (Security control 4), so an unknown value must be rejected
    // rather than silently accepted.
    //
    // NEW_TAB_OR_WINDOW_ATTEMPT covers "new tab" and "new window" as a
    // single type (confirmed 2026-09-03, replacing the earlier
    // NEW_TAB_ATTEMPT wording of RULE-EXAM-05). EXTERNAL_APPLICATION_FOCUS
    // from that same rule is intentionally absent: it depends on a desktop
    // agent that is explicitly out of scope this round.
    await queryRunner.query(`
      CREATE TABLE exam_monitoring_event_type (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_monitoring_config_id uuid NOT NULL REFERENCES exam_monitoring_config(id),
        event_type varchar(40) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_monitoring_event_type_config_unique
          UNIQUE (exam_monitoring_config_id, event_type),
        CONSTRAINT exam_monitoring_event_type_check
          CHECK (event_type IN (
            'PAGE_BLUR',
            'PAGE_VISIBILITY_CHANGED',
            'NEW_TAB_OR_WINDOW_ATTEMPT',
            'EXTERNAL_NAVIGATION_ATTEMPT',
            'KEYBOARD_RESTRICTION_TRIGGERED',
            'PAGE_RELOAD'
          ))
      )
    `);

    // RULE-EXAM-12 states 7 states, but only 5 are persisted here:
    // NOT_STARTED and AVAILABLE are CALCULATED from the availability window
    // (RULE-EXAM-06) and never stored — the row only comes into existence
    // when the student actually starts, i.e. already IN_PROGRESS (approved
    // assumption). The CHECK enforces that: persisting NOT_STARTED or
    // AVAILABLE is a bug, not a valid state.
    //   COMPLETED  = student finished;
    //   TERMINATED = ended by the violation policy (RULE-EXAM-04);
    //   EXPIRED    = individual duration ran out (RULE-EXAM-08);
    //   ABANDONED  = started, never finished, and the exam's availability
    //                window closed with the session still IN_PROGRESS
    //                (confirmed 2026-09-03) — the complement of EXPIRED,
    //                covering sessions with no individual duration. Purely
    //                a service-side transition; the schema needs nothing
    //                beyond this state.
    //
    // Snapshot columns follow the precedent already set by class_session's
    // *_snapshot columns: the configuration in force when the session was
    // created is frozen onto the session, so a teacher editing the exam
    // mid-flight cannot change the rules of a session already running.
    //
    // expires_at is the absolute deadline handed to the frontend
    // (RULE-EXAM-07/11) — recomputed nowhere else, re-served as-is on
    // reload. The CHECK keeps it consistent with the snapshot: no duration
    // limit means no deadline, and vice versa.
    //
    // UNIQUE (tenant_id, exam_id, person_id): one single attempt per
    // student per exam (confirmed 2026-09-03) — there is no attempt number
    // and no per-exam attempt allowance, so the constraint is the whole
    // rule.
    //
    // UNIQUE (id, person_id) is not a business rule: it is the target of
    // the composite foreign keys used by exam_answer / exam_session_event
    // to guarantee their denormalized person_id really is the session
    // owner's (see those tables).
    await queryRunner.query(`
      CREATE TABLE exam_session (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_id uuid NOT NULL REFERENCES exam(id),
        person_id uuid NOT NULL REFERENCES person(id),
        status varchar(20) NOT NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz,
        ended_at timestamptz,
        duration_minutes_snapshot int,
        monitoring_mode_snapshot varchar(20) NOT NULL,
        monitored_event_types_snapshot text[] NOT NULL DEFAULT '{}',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_session_exam_person_unique UNIQUE (tenant_id, exam_id, person_id),
        CONSTRAINT exam_session_id_person_unique UNIQUE (id, person_id),
        CONSTRAINT exam_session_status_check
          CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'TERMINATED', 'EXPIRED', 'ABANDONED')),
        CONSTRAINT exam_session_monitoring_mode_snapshot_check
          CHECK (monitoring_mode_snapshot IN ('TERMINATE', 'LOG_ONLY')),
        CONSTRAINT exam_session_duration_snapshot_check
          CHECK (duration_minutes_snapshot IS NULL OR duration_minutes_snapshot > 0),
        CONSTRAINT exam_session_expires_at_check
          CHECK ((duration_minutes_snapshot IS NULL) = (expires_at IS NULL))
      )
    `);

    // Teacher's live panel (polling): sessions of one exam, filtered by
    // state.
    await queryRunner.query(`
      CREATE INDEX exam_session_exam_status_idx ON exam_session (tenant_id, exam_id, status)
    `);

    // Student's own exam area: "my sessions". The uniqueness above is
    // ordered (tenant, exam, person) and cannot serve this lookup.
    await queryRunner.query(`
      CREATE INDEX exam_session_person_idx ON exam_session (tenant_id, person_id)
    `);

    // UNIQUE (exam_session_id, exam_question_id) is what makes incremental
    // autosave possible: the client upserts the same row as the student
    // types, instead of the answer existing only after a final submit.
    //
    // person_id is denormalized from exam_session on purpose — it is what
    // lets the RLS ownership policy be a plain column comparison instead of
    // a correlated subquery on every row. The composite FK
    // (exam_session_id, person_id) -> exam_session (id, person_id) makes
    // that copy impossible to falsify: the pair must exist on the session.
    //
    // answer_text serves SHORT_ANSWER/PARAGRAPH; objective answers live in
    // exam_answer_selected_option. awarded_points is filled automatically
    // for objective questions and manually by the teacher for subjective
    // ones, bounded by exam_question.points (RULE-EXAM-14). NULL means "not
    // graded yet", which is why it is nullable and not defaulted to 0.
    await queryRunner.query(`
      CREATE TABLE exam_answer (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_session_id uuid NOT NULL,
        person_id uuid NOT NULL,
        exam_question_id uuid NOT NULL REFERENCES exam_question(id),
        answer_text text,
        awarded_points numeric(6, 2),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_answer_session_question_unique UNIQUE (exam_session_id, exam_question_id),
        CONSTRAINT exam_answer_id_person_unique UNIQUE (id, person_id),
        CONSTRAINT exam_answer_session_fk
          FOREIGN KEY (exam_session_id, person_id) REFERENCES exam_session (id, person_id),
        CONSTRAINT exam_answer_awarded_points_check CHECK (awarded_points IS NULL OR awarded_points >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX exam_answer_question_idx ON exam_answer (tenant_id, exam_question_id)
    `);

    // Selected options of an objective answer: one row per checked option
    // (several for CHECKBOXES, exactly one for MULTIPLE_CHOICE — the
    // "exactly one" part is an application-layer rule, since SQL cannot
    // express it without a trigger).
    //
    // person_id is carried here for the same reason as in exam_answer, and
    // guaranteed by the composite FK back to exam_answer: knowing which
    // option another student picked is already a leak of their answer, so
    // this table gets the ownership predicate too, not just tenant
    // isolation.
    await queryRunner.query(`
      CREATE TABLE exam_answer_selected_option (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_answer_id uuid NOT NULL,
        person_id uuid NOT NULL,
        exam_question_option_id uuid NOT NULL REFERENCES exam_question_option(id),
        created_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_answer_selected_option_unique UNIQUE (exam_answer_id, exam_question_option_id),
        CONSTRAINT exam_answer_selected_option_answer_fk
          FOREIGN KEY (exam_answer_id, person_id) REFERENCES exam_answer (id, person_id)
      )
    `);

    // RULE-EXAM-12's audit trail: append-only, one row per relevant session
    // event (start, monitoring occurrence, expiry, termination, finish).
    //
    // occurred_at defaults to now() and is written by the server — a
    // client-supplied timestamp is never trusted (RULE-EXAM-07), so the
    // column has no client-facing counterpart.
    //
    // event_type is free text (no CHECK, no FK): new event types must not
    // require a migration, and server-generated events (e.g.
    // EXAM_TIME_EXPIRED) share the column with client-reported ones. The
    // allow-list for what a CLIENT may report is enforced in the
    // application layer (Security control 4) — the two write paths are
    // separated there, not here.
    //
    // treated_as_violation records whether the violation policy acted on
    // the event. It matters for PAGE_RELOAD specifically: RULE-EXAM-11
    // always logs a reload, but it only counts as a violation when that
    // event type is enabled for the exam.
    await queryRunner.query(`
      CREATE TABLE exam_session_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        exam_session_id uuid NOT NULL,
        person_id uuid NOT NULL,
        event_type varchar(60) NOT NULL,
        treated_as_violation boolean NOT NULL DEFAULT false,
        details jsonb,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT exam_session_event_session_fk
          FOREIGN KEY (exam_session_id, person_id) REFERENCES exam_session (id, person_id)
      )
    `);

    // Teacher's violation timeline for one session, in chronological order.
    await queryRunner.query(`
      CREATE INDEX exam_session_event_session_occurred_idx
      ON exam_session_event (exam_session_id, occurred_at)
    `);

    for (const table of [
      'exam',
      'exam_question',
      'exam_question_option',
      'exam_monitoring_config',
      'exam_monitoring_event_type',
      'exam_session',
      'exam_answer',
      'exam_answer_selected_option',
      'exam_session_event',
    ]) {
      await queryRunner.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE ${table} FORCE ROW LEVEL SECURITY`);
    }

    // Exam content is tenant-scoped only: questions and options are the
    // same for every student of the class group, and hiding the answer key
    // from the student is a payload concern (RULE-EXAM-17), not a row
    // visibility one.
    for (const table of [
      'exam',
      'exam_question',
      'exam_question_option',
      'exam_monitoring_config',
      'exam_monitoring_event_type',
    ]) {
      await queryRunner.query(`
        CREATE POLICY tenant_isolation ON ${table}
        USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
        WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
      `);
    }

    // Student-owned tables get two permissive policies, OR'd by Postgres:
    //   student_ownership — the row belongs to the person in app.person_id;
    //   management_scope  — the request was already authorized as
    //                       teacher/coordinator/direction management or
    //                       audit access (RULE-EXAM-16), which legitimately
    //                       spans every student of the class group.
    // Neither GUC set => no rows and no writes (fail-closed). NULLIF guards
    // against an empty-string GUC, which would raise on ::uuid instead of
    // simply matching nothing.
    for (const table of ['exam_session', 'exam_answer', 'exam_answer_selected_option', 'exam_session_event']) {
      await queryRunner.query(`
        CREATE POLICY student_ownership ON ${table}
        USING (
          tenant_id = current_setting('app.tenant_id', true)::uuid
          AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
        WITH CHECK (
          tenant_id = current_setting('app.tenant_id', true)::uuid
          AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      `);
      await queryRunner.query(`
        CREATE POLICY management_scope ON ${table}
        USING (
          tenant_id = current_setting('app.tenant_id', true)::uuid
          AND current_setting('app.exam_management_scope', true) = 'on'
        )
        WITH CHECK (
          tenant_id = current_setting('app.tenant_id', true)::uuid
          AND current_setting('app.exam_management_scope', true) = 'on'
        )
      `);
    }

    for (const table of [
      'exam',
      'exam_question',
      'exam_question_option',
      'exam_monitoring_config',
      'exam_monitoring_event_type',
      'exam_session',
      'exam_answer',
      'exam_answer_selected_option',
    ]) {
      await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${table} TO ${appDbUsername}`);
    }

    // Immutability of the audit trail, required at the database level by
    // the Security review — application discipline is not enough, the trail
    // must survive a bug in the very layer that writes it. Two independent
    // locks:
    //   1. the application role is only granted SELECT/INSERT (and UPDATE/
    //      DELETE/TRUNCATE are explicitly revoked, in case a broader grant
    //      is ever applied to the whole schema);
    //   2. a trigger that refuses UPDATE/DELETE for ANY role, including the
    //      table owner and superusers, which grants alone cannot stop.
    await queryRunner.query(`GRANT SELECT, INSERT ON exam_session_event TO ${appDbUsername}`);
    await queryRunner.query(
      `REVOKE UPDATE, DELETE, TRUNCATE ON exam_session_event FROM ${appDbUsername}`,
    );
    await queryRunner.query(`
      CREATE FUNCTION exam_session_event_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'exam_session_event is append-only: % is not allowed', TG_OP;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER exam_session_event_append_only_trigger
      BEFORE UPDATE OR DELETE ON exam_session_event
      FOR EACH ROW EXECUTE FUNCTION exam_session_event_append_only()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER IF EXISTS exam_session_event_append_only_trigger ON exam_session_event');
    await queryRunner.query('DROP FUNCTION IF EXISTS exam_session_event_append_only()');

    // Reverse dependency order (children first) so the drops stay valid
    // even without CASCADE doing the work.
    for (const table of [
      'exam_session_event',
      'exam_answer_selected_option',
      'exam_answer',
      'exam_session',
      'exam_monitoring_event_type',
      'exam_monitoring_config',
      'exam_question_option',
      'exam_question',
      'exam',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }
}
