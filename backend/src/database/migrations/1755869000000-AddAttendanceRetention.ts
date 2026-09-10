import { MigrationInterface, QueryRunner } from 'typeorm';

// Frente 10 — Conformidade LGPD e retenção (RULE-RET-01/02,
// business-rules/references/data-retention-rules.md), from the architecture
// and technology decisions approved by the user on 2026-09-09
// (architecture-overview.md, "Decisão de arquitetura/tecnologia —
// Conformidade LGPD e retenção, Frente 10"). Two tables:
//
//   1. attendance_closure_document — one row per (tenant, closure period):
//      the monthly closures RULE-RET-01 requires before the 60-day-old rows
//      of raw_identification_event/identification_checkin/presence_interval/
//      session_attendance_consolidation leave the live database, and the
//      annual consolidation RULE-RET-02 requires after 12 monthly closures
//      accumulate. This migration only creates the table — the Fechamento/
//      Expurgo/Consolidação Anual services, the CLI scripts that drive them,
//      and the actual purge of the four RULE-RET-01 source tables are
//      Backend's to build on top of it. Those four source tables and
//      attendance_pending_review are NOT touched by this migration: the
//      approved technology decision (item 4) deliberately adds no column to
//      any of them — the pending-review purge gate is a join at expurgo
//      query time, not a schema change.
//   2. attendance_frequency_period_aggregate — the durable, incremental
//      replacement for Controle B's full-rescan of
//      session_attendance_consolidation across the whole reporting period,
//      approved as the resolution to the Frente 10 architecture's Open
//      Question 1 (Controle B would otherwise silently break for
//      trimestral/semestral periods once the 60-day expurgo starts
//      removing rows it used to reread). See the entity file for why this
//      is a new table rather than an extension of
//      attendance_frequency_warning. Populating/incrementing it at each
//      finalization event, and making AttendanceFrequencyEngineService read
//      from it instead of countInWindow(), is Backend's work — out of scope
//      here.
//
// Both tables get tenant_id + RLS, same posture as every table added since
// Segurança de Intrusão — but the SHAPE of that RLS differs between them,
// deliberately:
//   - attendance_closure_document has no confirmed owner/reader other than
//     the unattended retention job itself (who besides the job may download
//     a closure document is Frente 10 Open Question 4, still unresolved —
//     see architecture-overview.md). Rather than presume an access rule that
//     was never confirmed, this table is reachable ONLY through the new
//     app.attendance_retention_job GUC — the same mechanism, same naming
//     convention, already used for
//     app.absence_justification_retention_job in AddAbsenceJustification.
//     Adding an interactive read policy later (once Open Question 4 is
//     resolved) is purely additive, same precedent already used elsewhere in
//     this codebase for a policy that does not exist yet.
//   - attendance_frequency_period_aggregate is written by ordinary
//     request-scoped application code (session finalization), not by the
//     retention job, so it gets the same plain tenant_isolation policy as
//     its sibling attendance_frequency_warning — no job GUC involved.
//
// NOTE for whoever next touches ClassGroupDeletionOrchestratorService: like
// attendance_frequency_warning before it, attendance_frequency_period_
// aggregate has a real FK to class_group and will block a turma's deletion
// unless that orchestrator also deletes this table's rows for the turma.
export class AddAttendanceRetention1755869000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

    // ---------------------------------------------------------------------
    // 1. attendance_closure_document — RULE-RET-01/02. METADATA ONLY: the
    // artifact itself lives in the new, dedicated S3-compatible bucket
    // (checkclass-attendance-retention-documents, technology decision item
    // 1), never in this row. See the entity file for the full reasoning
    // behind every column.
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE attendance_closure_document (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        period_type varchar(10) NOT NULL,
        period_year smallint NOT NULL,
        period_month smallint,
        generated_at timestamptz NOT NULL DEFAULT now(),
        summary jsonb NOT NULL,
        storage_key varchar(500),
        mime_type varchar(100),
        size_bytes int,
        checksum_sha256 char(64) NOT NULL,
        content_deleted_at timestamptz,
        consolidated_into_document_id uuid REFERENCES attendance_closure_document (id),
        CONSTRAINT attendance_closure_document_period_type_check
          CHECK (period_type IN ('monthly', 'annual')),
        -- period_month is meaningful only for a monthly closure; an annual
        -- closure covers the whole year, so the column stays NULL for it.
        CONSTRAINT attendance_closure_document_period_month_check CHECK (
          (period_type = 'monthly' AND period_month BETWEEN 1 AND 12)
          OR (period_type = 'annual' AND period_month IS NULL)
        ),
        -- storage_key is present iff the content has not been eliminated yet
        -- (same shape as absence_justification_attachment's equivalent
        -- check) — content_deleted_at is only ever set by the annual
        -- consolidation, on the 12 monthly rows it just folded in.
        CONSTRAINT attendance_closure_document_storage_key_deleted_check
          CHECK ((content_deleted_at IS NULL) = (storage_key IS NOT NULL)),
        -- Size-limited summary/counts only, never the raw detailed content
        -- (RULE-RET-01's "resumo/contagens", not the dataset) — the 16 KB
        -- ceiling is generous for that shape and exists specifically to keep
        -- this column from becoming the TOAST/backup-weight anti-pattern the
        -- Frente 10 technology decision rejected for the artifact itself.
        CONSTRAINT attendance_closure_document_summary_size_check
          CHECK (octet_length(summary::text) <= 16384),
        CONSTRAINT attendance_closure_document_not_self_consolidated_check
          CHECK (consolidated_into_document_id IS NULL OR consolidated_into_document_id <> id)
      )
    `);

    // One closure per (tenant, month) / (tenant, year) — two partial unique
    // indexes instead of one UNIQUE(tenant_id, period_year, period_month)
    // because Postgres treats NULL period_month values as distinct from each
    // other, which would let multiple annual rows exist for the same
    // (tenant, year) undetected.
    await queryRunner.query(`
      CREATE UNIQUE INDEX attendance_closure_document_monthly_unique
      ON attendance_closure_document (tenant_id, period_year, period_month)
      WHERE period_type = 'monthly'
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX attendance_closure_document_annual_unique
      ON attendance_closure_document (tenant_id, period_year)
      WHERE period_type = 'annual'
    `);

    // The 12 monthly rows folded into one annual row — the consolidation
    // job's own "did I already tag all 12" check, and any future audit
    // query walking from an annual document back to its sources.
    await queryRunner.query(`
      CREATE INDEX attendance_closure_document_consolidated_into_idx
      ON attendance_closure_document (consolidated_into_document_id)
      WHERE consolidated_into_document_id IS NOT NULL
    `);

    await queryRunner.query('ALTER TABLE attendance_closure_document ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE attendance_closure_document FORCE ROW LEVEL SECURITY');

    // The unattended retention job (Fechamento Mensal / Expurgo / Consolidação
    // Anual) is, today, the ONLY confirmed actor for this table — see the
    // file header for why there is no interactive/management policy yet.
    // Same GUC pattern as app.absence_justification_retention_job
    // (AddAbsenceJustification): set only by the unattended script, never by
    // an HTTP request. With the GUC unset, this table returns zero rows and
    // rejects writes — by design.
    await queryRunner.query(`
      CREATE POLICY retention_job_scope ON attendance_closure_document
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.attendance_retention_job', true) = 'on'
      )
      WITH CHECK (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.attendance_retention_job', true) = 'on'
      )
    `);

    // No DELETE: RULE-RET-02 only ever mutates a monthly row's content
    // fields (storage_key/content_deleted_at) on consolidation — a closure
    // document row itself is never removed.
    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE ON attendance_closure_document TO ${appDbUsername}`,
    );

    // ---------------------------------------------------------------------
    // 2. attendance_frequency_period_aggregate — Controle B's durable
    // incremental aggregate (Frente 10 architecture Open Question 1). See
    // the entity file for why this is a new table, not an extension of
    // attendance_frequency_warning.
    // ---------------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE attendance_frequency_period_aggregate (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        person_id uuid NOT NULL REFERENCES person(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        subject_id uuid NOT NULL REFERENCES subject(id),
        period_start_date date NOT NULL,
        period_end_date date NOT NULL,
        present_count int NOT NULL,
        considered_count int NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT attendance_frequency_period_aggregate_date_range_check
          CHECK (period_end_date >= period_start_date),
        CONSTRAINT attendance_frequency_period_aggregate_unique
          UNIQUE (tenant_id, person_id, class_group_id, subject_id, period_start_date, period_end_date)
      )
    `);

    await queryRunner.query('ALTER TABLE attendance_frequency_period_aggregate ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE attendance_frequency_period_aggregate FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON attendance_frequency_period_aggregate
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    await queryRunner.query(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_frequency_period_aggregate TO ${appDbUsername}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS attendance_frequency_period_aggregate CASCADE');
    await queryRunner.query('DROP TABLE IF EXISTS attendance_closure_document CASCADE');
  }
}
