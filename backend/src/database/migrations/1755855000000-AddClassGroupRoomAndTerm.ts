import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-07: room moves from being assigned per class_session to being
// assigned once at the class_group level — sessions now inherit it (see
// AddClassSessionScheduleFields). Nullable: turma composition ("montar
// turma") can plausibly start before a room is picked, and there is no
// existing class_group-level room data to backfill from (the previous model
// only ever recorded room_id on class_session). Enforcing "a room is
// required before the turma's schedule is published" is a montar-turma
// workflow rule for the Backend Agent, not a blanket DB invariant.
//
// Also adds term_start_date/term_end_date, per the approved architecture's
// decision that the letivo period lives on class_group itself (no separate
// "Período Letivo" entity this round) — same nullability reasoning: no
// existing data to backfill, required-ness is a montar-turma-flow concern.
export class AddClassGroupRoomAndTerm1755855000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE class_group
      ADD COLUMN room_id uuid REFERENCES room(id),
      ADD COLUMN term_start_date date,
      ADD COLUMN term_end_date date
    `);

    // Supports RULE-INST-06 (room must show up directly on operational
    // screens for a turma) and ScheduleConflictDetectionService's
    // room-overlap check.
    await queryRunner.query('CREATE INDEX class_group_room_id_idx ON class_group (room_id)');

    await queryRunner.query(`
      ALTER TABLE class_group
      ADD CONSTRAINT class_group_term_dates_check
      CHECK (term_start_date IS NULL OR term_end_date IS NULL OR term_end_date >= term_start_date)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE class_group DROP CONSTRAINT IF EXISTS class_group_term_dates_check');
    await queryRunner.query('DROP INDEX IF EXISTS class_group_room_id_idx');
    await queryRunner.query(`
      ALTER TABLE class_group
      DROP COLUMN IF EXISTS term_end_date,
      DROP COLUMN IF EXISTS term_start_date,
      DROP COLUMN IF EXISTS room_id
    `);
  }
}
