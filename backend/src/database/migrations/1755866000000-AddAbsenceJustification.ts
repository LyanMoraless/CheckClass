import { MigrationInterface, QueryRunner } from 'typeorm';

// Frente 07 — Justificativa de Faltas. Six tables implementing
// RULE-JUST-01..24 (business-rules/references/absence-justification-rules.md),
// from the data-modeling proposal reviewed and approved by the user
// (including the Security Agent's RLS addendum under RULE-JUST-24) on
// 2026-09-08. Depends on class_group_subject_teacher
// (AddClassGroupSubjectTeacher, previous migration) for RULE-JUST-24's
// teacher_subject_scope policies below.
//
// Cross-cutting notes that apply to every table in this migration:
//   - tenant_id + RLS on all six, never "inherited" through a FK — same
//     posture as every table added since Segurança de Intrusão.
//   - RULE-JUST-04 classifies this whole family as sensitive health/belief
//     data under LGPD Art. 11. RULE-JUST-08/12/20/24 cut access to the
//     attachment, legal category and rejection motivo down to the titular
//     and the specific subject-teacher, explicitly excluding the leadership
//     chain (a deliberate divergence from RULE-ATT-12's precedent) — RLS
//     below enforces the ROW; a DTO allow-list (Backend Agent, same split
//     already used for RULE-EXAM-17) is still needed on top to redact
//     legal_category/description/note from the management_scope read path
//     (RULE-JUST-12/20: leadership sees only "justificado/não justificado,
//     quem, quando").
//
// THREE new GUCs this migration's policies depend on — none of them are set
// today by TenantContextService, same fail-closed framing already used by
// AddExamArea for app.person_id/app.exam_management_scope:
//   - app.person_id                                — reused from the Exam
//     Area, the authenticated person making the request.
//   - app.absence_justification_management_scope    — set to 'on' only
//     after Coordenação/Direção authority over the item's turma/curso is
//     confirmed (LeadershipScopeService-equivalent check), same GUC-pattern
//     as app.exam_management_scope. ALSO the door for the "remover matéria
//     de turma" administrative action (RULE-JUST-18.1-2) to close items —
//     that mutation is not a per-item teacher decision, it is a structural
//     administrative write, and reusing this GUC (rather than inventing a
//     narrower one for a single call site) keeps the surface small.
//     Deliberately NOT granted on absence_justification_attachment (see
//     that table below) — RULE-JUST-08 excludes leadership from the file
//     itself, without exception.
//   - app.absence_justification_retention_job        — set ONLY by the
//     unattended scheduled job that eliminates an attachment 30 days after
//     its submission's last item goes terminal (RULE-JUST-19). No HTTP
//     request ever sets this. It exists because the job is neither the
//     titular, nor a subject-teacher, nor "leadership viewing a decision"
//     (management_scope is excluded from this table on purpose) — it needed
//     its own narrow door, distinct in MEANING even though it looks like a
//     third permissive policy.
// With none of these GUCs set, all six tables return zero rows and reject
// writes outside the titular's own — by design.
export class AddAbsenceJustification1755866000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    // ---------------------------------------------------------------------
    // 1. absence_justification_submission — the "envio" (RULE-JUST-01
    // addendum/06). No status column: RULE-JUST-06 is explicit that
    // aprovado/rejeitado are states of the ITEM, never of the envio.
    // legal_category is the fixed, system-wide vocabulary of RULE-JUST-12
    // (composition pending legal validation, not a legal fact yet).
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE absence_justification_submission (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        start_date date NOT NULL,
        end_date date NOT NULL,
        legal_category varchar(50) NOT NULL,
        description text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT absence_justification_submission_date_range_check CHECK (end_date >= start_date),
        CONSTRAINT absence_justification_submission_legal_category_check CHECK (legal_category IN (
          'illness_temporary_incapacity',
          'pregnancy_maternity_leave',
          'military_service',
          'judicial_electoral_summons',
          'official_sports_representation',
          'student_representation',
          'religious_conviction_exemption',
          'family_bereavement',
          'other_institutional_regulation'
        )),
        CONSTRAINT absence_justification_submission_id_person_unique UNIQUE (id, person_id)
      )
    `);

    // Student's own "my requests" list.
    await queryRunner.query(`
      CREATE INDEX absence_justification_submission_person_idx
      ON absence_justification_submission (tenant_id, person_id)
    `);

    // ---------------------------------------------------------------------
    // 2. absence_justification_item — RULE-JUST-06/13/14/16/18. One row per
    // faltada class_session. class_group_id/subject_id denormalized from
    // class_session, frozen at creation. The two partial UNIQUE indexes are
    // RULE-JUST-16 items 1-2 as DB invariants, not code discipline.
    //
    // Created here, BEFORE submission's own RLS/policies below, because
    // submission's teacher_subject_scope policy (right after this block)
    // queries this table — it must already exist. RLS/policies for this
    // table itself are applied further down, after submission's, to keep
    // the "table, then its own RLS" shape for the rest of this file.
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE absence_justification_item (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        submission_id uuid NOT NULL,
        person_id uuid NOT NULL,
        class_session_id uuid NOT NULL REFERENCES class_session(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        subject_id uuid NOT NULL REFERENCES subject(id),
        status varchar(30) NOT NULL DEFAULT 'under_review',
        decided_by_person_id uuid REFERENCES person(id),
        decided_at timestamptz,
        terminal_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT absence_justification_item_submission_fk
          FOREIGN KEY (submission_id, person_id)
          REFERENCES absence_justification_submission (id, person_id),
        CONSTRAINT absence_justification_item_status_check CHECK (status IN (
          'under_review', 'approved', 'rejected', 'cancelled_by_student',
          'closed_subject_removed', 'approval_revoked'
        )),
        CONSTRAINT absence_justification_item_id_person_group_subject_unique
          UNIQUE (id, person_id, class_group_id, subject_id)
      )
    `);

    // RULE-JUST-16.1: at most one item under_review per (session, aluno).
    await queryRunner.query(`
      CREATE UNIQUE INDEX absence_justification_item_one_under_review_per_session
      ON absence_justification_item (tenant_id, class_session_id, person_id)
      WHERE status = 'under_review'
    `);

    // RULE-JUST-16.2: at most one item approved per (session, aluno).
    // Revoking (approved -> approval_revoked) frees this index, which is
    // exactly what lets RULE-JUST-17.6 allow a fresh approval later.
    await queryRunner.query(`
      CREATE UNIQUE INDEX absence_justification_item_one_approved_per_session
      ON absence_justification_item (tenant_id, class_session_id, person_id)
      WHERE status = 'approved'
    `);

    // Professor's decision queue: "my under_review items for this
    // (turma, matéria)".
    await queryRunner.query(`
      CREATE INDEX absence_justification_item_class_group_subject_status_idx
      ON absence_justification_item (tenant_id, class_group_id, subject_id, status)
    `);

    // Listing every item of one envio.
    await queryRunner.query(`
      CREATE INDEX absence_justification_item_submission_idx
      ON absence_justification_item (submission_id)
    `);

    await queryRunner.query('ALTER TABLE absence_justification_submission ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE absence_justification_submission FORCE ROW LEVEL SECURITY');

    await queryRunner.query(`
      CREATE POLICY student_ownership ON absence_justification_submission
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
    `);

    // RULE-JUST-24: the subject-teacher of AT LEAST ONE item of this envio
    // (a professor of Matemática, say, needs to see the envio row even
    // though it may also carry an item for Física taught by someone else —
    // the row is one envio, not one row per matéria).
    await queryRunner.query(`
      CREATE POLICY teacher_subject_scope ON absence_justification_submission
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1
          FROM absence_justification_item i
          JOIN class_group_subject_teacher t
            ON t.tenant_id = i.tenant_id
           AND t.class_group_id = i.class_group_id
           AND t.subject_id = i.subject_id
          WHERE i.submission_id = absence_justification_submission.id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1
          FROM absence_justification_item i
          JOIN class_group_subject_teacher t
            ON t.tenant_id = i.tenant_id
           AND t.class_group_id = i.class_group_id
           AND t.subject_id = i.subject_id
          WHERE i.submission_id = absence_justification_submission.id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
    `);

    await queryRunner.query(`
      CREATE POLICY management_scope ON absence_justification_submission
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_management_scope', true) = 'on'
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_management_scope', true) = 'on'
      )
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON absence_justification_submission TO ${appDbUsername}`,
    );

    // ---------------------------------------------------------------------
    // absence_justification_item's own RLS/policies. The table itself was
    // already created above (before submission's policies, which query it).
    // ---------------------------------------------------------------------
    await queryRunner.query('ALTER TABLE absence_justification_item ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE absence_justification_item FORCE ROW LEVEL SECURITY');

    await queryRunner.query(`
      CREATE POLICY student_ownership ON absence_justification_item
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
      CREATE POLICY teacher_subject_scope ON absence_justification_item
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1 FROM class_group_subject_teacher t
          WHERE t.tenant_id = absence_justification_item.tenant_id
            AND t.class_group_id = absence_justification_item.class_group_id
            AND t.subject_id = absence_justification_item.subject_id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1 FROM class_group_subject_teacher t
          WHERE t.tenant_id = absence_justification_item.tenant_id
            AND t.class_group_id = absence_justification_item.class_group_id
            AND t.subject_id = absence_justification_item.subject_id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
    `);

    // Also the door for the administrative "matéria removida da turma"
    // write (RULE-JUST-18.1-2) — see the GUC note at the top of this file.
    await queryRunner.query(`
      CREATE POLICY management_scope ON absence_justification_item
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_management_scope', true) = 'on'
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_management_scope', true) = 'on'
      )
    `);

    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON absence_justification_item TO ${appDbUsername}`);

    // ---------------------------------------------------------------------
    // 3. absence_justification_item_decision — RULE-JUST-17's
    // non-destructive decision trail. INSERT-only by convention (see the
    // entity file for why this does NOT get the REVOKE+trigger treatment,
    // unlike the access log below).
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE absence_justification_item_decision (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        item_id uuid NOT NULL,
        person_id uuid NOT NULL,
        class_group_id uuid NOT NULL,
        subject_id uuid NOT NULL,
        decision_type varchar(20) NOT NULL,
        decided_by_person_id uuid NOT NULL REFERENCES person(id),
        note text,
        decided_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT absence_justification_item_decision_item_fk
          FOREIGN KEY (item_id, person_id, class_group_id, subject_id)
          REFERENCES absence_justification_item (id, person_id, class_group_id, subject_id),
        CONSTRAINT absence_justification_item_decision_type_check
          CHECK (decision_type IN ('approved', 'rejected', 'revoked')),
        -- RULE-JUST-03 addendum item 1 / RULE-JUST-17.1: note is required for
        -- rejected/revoked, optional for approved.
        CONSTRAINT absence_justification_item_decision_note_required_check
          CHECK (decision_type = 'approved' OR note IS NOT NULL)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX absence_justification_item_decision_item_idx
      ON absence_justification_item_decision (item_id, decided_at)
    `);

    await queryRunner.query('ALTER TABLE absence_justification_item_decision ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE absence_justification_item_decision FORCE ROW LEVEL SECURITY');

    await queryRunner.query(`
      CREATE POLICY student_ownership ON absence_justification_item_decision
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
    `);

    // This is the policy that actually authorizes every real INSERT here:
    // decisions are always written by the subject-teacher (approve/reject/
    // revoke are all professor-only acts, RULE-JUST-08/17.2), never by the
    // student.
    await queryRunner.query(`
      CREATE POLICY teacher_subject_scope ON absence_justification_item_decision
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1 FROM class_group_subject_teacher t
          WHERE t.tenant_id = absence_justification_item_decision.tenant_id
            AND t.class_group_id = absence_justification_item_decision.class_group_id
            AND t.subject_id = absence_justification_item_decision.subject_id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1 FROM class_group_subject_teacher t
          WHERE t.tenant_id = absence_justification_item_decision.tenant_id
            AND t.class_group_id = absence_justification_item_decision.class_group_id
            AND t.subject_id = absence_justification_item_decision.subject_id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
    `);

    await queryRunner.query(`
      CREATE POLICY management_scope ON absence_justification_item_decision
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_management_scope', true) = 'on'
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_management_scope', true) = 'on'
      )
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON absence_justification_item_decision TO ${appDbUsername}`,
    );

    // ---------------------------------------------------------------------
    // 4. absence_justification_attachment — RULE-JUST-09/11/19. METADATA
    // ONLY, the binary lives in the approved S3-compatible object storage.
    // One row per submission (1:1). Elimination (RULE-JUST-19) is a mutation
    // of THIS row (storage_key -> NULL, deleted_at stamped), never a DELETE
    // and never touches item/item_decision/submission/notice — nothing FKs
    // TO this table except the access log, which survives untouched too.
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE absence_justification_attachment (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        submission_id uuid NOT NULL,
        person_id uuid NOT NULL,
        storage_key varchar(500),
        original_filename varchar(255) NOT NULL,
        mime_type varchar(100) NOT NULL,
        size_bytes int NOT NULL,
        uploaded_at timestamptz NOT NULL DEFAULT now(),
        scheduled_deletion_at timestamptz,
        deleted_at timestamptz,
        CONSTRAINT absence_justification_attachment_submission_fk
          FOREIGN KEY (submission_id, person_id)
          REFERENCES absence_justification_submission (id, person_id),
        CONSTRAINT absence_justification_attachment_submission_unique UNIQUE (submission_id),
        CONSTRAINT absence_justification_attachment_id_person_unique UNIQUE (id, person_id),
        -- RULE-JUST-11's format/size decision: PDF, JPEG, PNG, up to 10 MB.
        CONSTRAINT absence_justification_attachment_mime_type_check
          CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png')),
        CONSTRAINT absence_justification_attachment_size_check
          CHECK (size_bytes > 0 AND size_bytes <= 10485760),
        -- storage_key is present iff the file has not been eliminated yet.
        CONSTRAINT absence_justification_attachment_storage_key_deleted_check
          CHECK ((deleted_at IS NULL) = (storage_key IS NOT NULL))
      )
    `);

    await queryRunner.query('ALTER TABLE absence_justification_attachment ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE absence_justification_attachment FORCE ROW LEVEL SECURITY');

    await queryRunner.query(`
      CREATE POLICY student_ownership ON absence_justification_attachment
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
      CREATE POLICY teacher_subject_scope ON absence_justification_attachment
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1
          FROM absence_justification_item i
          JOIN class_group_subject_teacher t
            ON t.tenant_id = i.tenant_id
           AND t.class_group_id = i.class_group_id
           AND t.subject_id = i.subject_id
          WHERE i.submission_id = absence_justification_attachment.submission_id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND EXISTS (
          SELECT 1
          FROM absence_justification_item i
          JOIN class_group_subject_teacher t
            ON t.tenant_id = i.tenant_id
           AND t.class_group_id = i.class_group_id
           AND t.subject_id = i.subject_id
          WHERE i.submission_id = absence_justification_attachment.submission_id
            AND t.person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
        )
      )
    `);

    // Deliberately NOT management_scope (RULE-JUST-08 excludes leadership
    // from the file, without exception — see the file header). Instead, a
    // narrow door for the unattended 30-day retention job (RULE-JUST-19),
    // which is neither the titular, nor a subject-teacher, nor leadership.
    await queryRunner.query(`
      CREATE POLICY retention_job_scope ON absence_justification_attachment
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_retention_job', true) = 'on'
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_retention_job', true) = 'on'
      )
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON absence_justification_attachment TO ${appDbUsername}`,
    );

    // ---------------------------------------------------------------------
    // 5. absence_justification_attachment_access_log — RULE-JUST-11.2/11.3.
    // Append-only AT THE DATABASE LEVEL, the exact mechanism the rule names
    // by precedent (exam_session_event, AddExamArea): revoke UPDATE/DELETE
    // from the app role, plus a trigger that refuses them for ANY role.
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE absence_justification_attachment_access_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        attachment_id uuid NOT NULL,
        attachment_owner_person_id uuid NOT NULL,
        accessed_by_person_id uuid NOT NULL REFERENCES person(id),
        access_result varchar(30) NOT NULL,
        denial_reason varchar(60),
        ip_address inet NOT NULL,
        user_agent text,
        occurred_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT absence_justification_attachment_access_log_attachment_fk
          FOREIGN KEY (attachment_id, attachment_owner_person_id)
          REFERENCES absence_justification_attachment (id, person_id),
        -- A third outcome beyond granted/denied, for an attempt against an
        -- already-eliminated attachment (RULE-JUST-19.5's explicit
        -- "arquivo eliminado", never a generic error).
        CONSTRAINT absence_justification_attachment_access_log_result_check
          CHECK (access_result IN ('granted', 'denied', 'deleted_unavailable'))
      )
    `);

    // Teacher/titular's access timeline for one attachment, chronological —
    // same shape as exam_session_event_session_occurred_idx.
    await queryRunner.query(`
      CREATE INDEX absence_justification_attachment_access_log_attachment_idx
      ON absence_justification_attachment_access_log (attachment_id, occurred_at)
    `);

    await queryRunner.query('ALTER TABLE absence_justification_attachment_access_log ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE absence_justification_attachment_access_log FORCE ROW LEVEL SECURITY');

    // INSERT is intentionally tenant-scoped only, not owner-restricted: this
    // row is always written by the backend as a side effect of someone ELSE
    // attempting to open the attachment (a professor, or a denied stranger)
    // — restricting INSERT to attachment_owner_person_id = app.person_id
    // would make it impossible to ever log anyone but the titular's own
    // access, defeating RULE-JUST-11.2's "todo acesso, inclusive de
    // terceiros". There is no user-facing "write a log row" endpoint; every
    // writer is the backend's own open-attachment code path.
    await queryRunner.query(`
      CREATE POLICY tenant_write ON absence_justification_attachment_access_log
      FOR INSERT
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    // READ is owner-only (RULE-JUST-11.4) — professor/coordenação/direção
    // never consult this log (pending-decisions.md, "quem pode consultar o
    // log": só o titular e o papel administração/DPO, que não existe ainda
    // no modelo — adding that policy later is purely additive).
    await queryRunner.query(`
      CREATE POLICY student_ownership_read ON absence_justification_attachment_access_log
      FOR SELECT
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND attachment_owner_person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT ON absence_justification_attachment_access_log TO ${appDbUsername}`,
    );
    await queryRunner.query(
      `REVOKE UPDATE, DELETE, TRUNCATE ON absence_justification_attachment_access_log FROM ${appDbUsername}`,
    );
    await queryRunner.query(`
      CREATE FUNCTION absence_justification_attachment_access_log_append_only() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'absence_justification_attachment_access_log is append-only: % is not allowed', TG_OP;
      END;
      $$ LANGUAGE plpgsql
    `);
    await queryRunner.query(`
      CREATE TRIGGER absence_justification_attachment_access_log_append_only_trigger
      BEFORE UPDATE OR DELETE ON absence_justification_attachment_access_log
      FOR EACH ROW EXECUTE FUNCTION absence_justification_attachment_access_log_append_only()
    `);

    // ---------------------------------------------------------------------
    // 6. absence_justification_notice — RULE-JUST-21/22. Written from
    // scratch, nothing shared with attendance_frequency_warning (RULE-
    // JUST-22: "nada herdado"). Never physically deleted.
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE absence_justification_notice (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL,
        submission_id uuid NOT NULL,
        subject_id uuid NOT NULL REFERENCES subject(id),
        notice_type varchar(30) NOT NULL,
        details jsonb NOT NULL,
        seen_at timestamptz,
        dismissed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT absence_justification_notice_submission_fk
          FOREIGN KEY (submission_id, person_id)
          REFERENCES absence_justification_submission (id, person_id),
        -- decision_result | approval_revoked — see the entity file for why
        -- a third value (closed_subject_removed with no decision at all) is
        -- deliberately left out of this vocabulary for now.
        CONSTRAINT absence_justification_notice_type_check
          CHECK (notice_type IN ('decision_result', 'approval_revoked')),
        CONSTRAINT absence_justification_notice_unique UNIQUE (submission_id, subject_id, notice_type)
      )
    `);

    // GET /v1/me/warnings-equivalent unified list read (RULE-JUST-22.6).
    await queryRunner.query(`
      CREATE INDEX absence_justification_notice_person_idx
      ON absence_justification_notice (tenant_id, person_id)
    `);

    await queryRunner.query('ALTER TABLE absence_justification_notice ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE absence_justification_notice FORCE ROW LEVEL SECURITY');

    // INSERT is tenant-scoped only, same reasoning as the access log: a
    // notice is always written by the backend as a side effect of the LAST
    // item of an (envio, matéria) turning terminal, which usually happens
    // inside the deciding PROFESSOR's own request — restricting INSERT to
    // person_id = app.person_id would block writing a notice for anyone but
    // the actor themselves, and the actor is essentially never the student
    // here (RULE-JUST-21 is emitted BY a professor's decision or a
    // system-driven closure, never by the student's own action).
    await queryRunner.query(`
      CREATE POLICY tenant_write ON absence_justification_notice
      FOR INSERT
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    // READ and the student's own seen/dismiss mutations are owner-only —
    // RULE-JUST-22.5: exclusive destinatário, no professor/coordenação/
    // direção access of any kind.
    await queryRunner.query(`
      CREATE POLICY student_ownership_read ON absence_justification_notice
      FOR SELECT
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
    `);
    await queryRunner.query(`
      CREATE POLICY student_ownership_update ON absence_justification_notice
      FOR UPDATE
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND person_id = NULLIF(current_setting('app.person_id', true), '')::uuid
      )
    `);

    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON absence_justification_notice TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP TRIGGER IF EXISTS absence_justification_attachment_access_log_append_only_trigger ' +
        'ON absence_justification_attachment_access_log',
    );
    await queryRunner.query(
      'DROP FUNCTION IF EXISTS absence_justification_attachment_access_log_append_only()',
    );

    for (const table of [
      'absence_justification_attachment_access_log',
      'absence_justification_item_decision',
      'absence_justification_attachment',
      'absence_justification_notice',
      'absence_justification_item',
      'absence_justification_submission',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
  }
}
