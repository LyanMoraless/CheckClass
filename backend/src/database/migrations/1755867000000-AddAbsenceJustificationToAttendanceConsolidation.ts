import { MigrationInterface, QueryRunner } from 'typeorm';

// Frente 07 addendum on session_attendance_consolidation (RULE-JUST-07/17.4)
// — separate migration from AddAbsenceJustification because it ALTERs a
// table owned by an earlier, already-closed frente (InitSchema/Controle A),
// same split already used in Frente 06 between AddAccumulatedFrequencyConfigColumns
// (ALTER of the existing attendance_config) and AddAttendanceFrequencyWarning
// (a brand new table).
//
// RULE-JUST-07 requires that an approved justified absence "conte como
// presença E permaneça distinguível de uma presença real" — not simply
// "status flips to present". RULE-JUST-17.4 makes the intent explicit:
// revoking an approval "devolve o registro de presença ao ESTADO `absent`",
// which only makes sense if approving had moved it to a DIFFERENT state.
// Hence a 4th status value, 'absent_justified', not a reuse of 'present'.
//
// This is also the FIRST CHECK constraint ever placed on this column — it
// has been unconstrained free varchar(20) since InitSchema. Safe to add now
// (pre-production, no real tenant data, same framing already used for every
// other schema change on tables from this era).
//
// justified_by_item_id is left SET (never nulled) when a revocation flips
// status back to 'absent' — that is what preserves "a marcação histórica de
// que houve uma justificativa aprovada e revogada" (RULE-JUST-17.1) without
// a second column. resolved_by_person_id/resolved_at (Controle A's
// pending-review resolution author, RULE-ATT-11/12) are untouched by any of
// this — RULE-JUST-07's whole point is that approving a justification must
// never overwrite who resolved the original chamada pendency.
//
// IMPORTANT for the Backend Agent implementing the Frente 07 approval
// caller: AttendanceFrequencyEngineService (Controle B) currently reads
// status IN ('present','absent') and treats 'present' as the numerator.
// 'absent_justified' must be added to that query (numerator like 'present',
// still counted in the denominator like the 'absent' it replaces) for
// RULE-JUST-03's "33/40, nunca 32/39" to hold once this column exists — this
// migration only adds the value, it does not and cannot change that
// already-implemented, already-closed Frente 06 query.
export class AddAbsenceJustificationToAttendanceConsolidation1755867000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE session_attendance_consolidation
      ADD COLUMN justified_by_item_id uuid REFERENCES absence_justification_item(id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX session_attendance_consolidation_justified_by_item_unique
      ON session_attendance_consolidation (justified_by_item_id)
      WHERE justified_by_item_id IS NOT NULL
    `);

    await queryRunner.query(`
      ALTER TABLE session_attendance_consolidation
      ADD CONSTRAINT session_attendance_consolidation_status_check
      CHECK (status IN ('present', 'absent', 'pending', 'absent_justified'))
    `);

    await queryRunner.query(`
      ALTER TABLE session_attendance_consolidation
      ADD CONSTRAINT session_attendance_consolidation_justified_status_check
      CHECK (status <> 'absent_justified' OR justified_by_item_id IS NOT NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE session_attendance_consolidation ' +
        'DROP CONSTRAINT IF EXISTS session_attendance_consolidation_justified_status_check',
    );
    await queryRunner.query(
      'ALTER TABLE session_attendance_consolidation DROP CONSTRAINT IF EXISTS session_attendance_consolidation_status_check',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS session_attendance_consolidation_justified_by_item_unique',
    );
    await queryRunner.query(
      'ALTER TABLE session_attendance_consolidation DROP COLUMN IF EXISTS justified_by_item_id',
    );
  }
}
