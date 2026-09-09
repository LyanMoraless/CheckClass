import { MigrationInterface, QueryRunner } from 'typeorm';

// Security Agent finding (blocking), post-review of Frente 07's
// AddAbsenceJustification migration: student_ownership/teacher_subject_scope
// on absence_justification_attachment already do their job perfectly for
// content protection — a requester with NO relation whatsoever to the
// submission gets zero rows back from Postgres itself. But that is exactly
// the shape AbsenceJustificationAttachmentService.download() needs to see in
// order to call logAccess() at all: RULE-JUST-11 item 2 ("Todo acesso ao
// conteúdo do anexo é registrado... inclusive tentativas negadas",
// Exceptions: Nenhuma) does not carve out an exemption for the case where
// RLS itself is what hides the row. Before this migration, that exact case
// — the most common shape of unauthorized access, a stranger or an
// unrelated student/teacher — left no audit trail at all.
//
// The fix is a THIRD, narrow, SELECT-ONLY door on
// absence_justification_attachment, same GUC-pattern already used for
// retention_job_scope (see AddAbsenceJustification's header): a request-
// scoped flag the backend turns on ONLY around the one existence-check
// query used to build a denial log row, and turns back off immediately
// after — never left set for the rest of the request/transaction. This does
// NOT weaken RLS's content protection: the row this policy exposes is used
// exclusively, server-side, to populate the access-log INSERT (attachment
// id + owner id) — AbsenceJustificationAttachmentService never returns any
// of these columns to an unauthorized caller; the HTTP response stays
// 403/404 either way.
export class AddAbsenceJustificationAccessLogLookupScope1755868000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE POLICY access_log_lookup_scope ON absence_justification_attachment
      FOR SELECT
      USING (
        tenant_id = current_setting('app.tenant_id', true)::uuid
        AND current_setting('app.absence_justification_access_log_scope', true) = 'on'
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP POLICY IF EXISTS access_log_lookup_scope ON absence_justification_attachment');
  }
}
