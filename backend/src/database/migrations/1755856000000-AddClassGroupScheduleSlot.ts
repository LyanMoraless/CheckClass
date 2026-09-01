import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-04/10 and the approved architecture's ScheduleConflictDetection/
// ScheduleRegenerationService both presuppose a recurring weekly schedule
// definition that concrete class_session rows get generated/regenerated
// from — no such table exists today (sessions are created one-by-one via
// session-create.ts). This is exactly the kind of technical detail
// RULE-INST-04's own text leaves to the Database Agent.
//
// Design: one row per (class_group, weekday, time-of-day) recurring slot —
// a class_group with a Mon/Wed/Fri weekly meeting has 3 rows. Room is
// deliberately NOT duplicated here: RULE-INST-07 already puts room on
// class_group (a single room for the whole turma), so
// ScheduleConflictDetectionService checks room overlap via
// class_group.room_id, not a per-slot room. day_of_week uses JS's own
// Date.getDay() convention (0 = Sunday .. 6 = Saturday) rather than ISO
// weekday (1 = Monday), since the Node/NestJS backend both writes and reads
// this value directly against JS Date objects when generating concrete
// class_session.scheduled_start/scheduled_end timestamps — avoids an
// ISO-weekday-vs-JS-weekday translation bug at every call site.
//
// Deliberately no slot-level history/versioning: when a recurring grade is
// edited, ScheduleRegenerationService's job (per the approved architecture)
// is to replace this class_group's slot rows and regenerate its *future,
// still-`scheduled`* class_session rows — the historical record of what a
// turma's schedule *used to be* lives in the class_session rows themselves
// (preserved, never overwritten, per RULE-INST-04), not in a versioned copy
// of the slot definition. Adding slot versioning now would be speculative
// complexity with no confirmed requirement behind it.
export class AddClassGroupScheduleSlot1755856000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE class_group_schedule_slot (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        class_group_id uuid NOT NULL REFERENCES class_group(id),
        day_of_week smallint NOT NULL,
        start_time time NOT NULL,
        end_time time NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT class_group_schedule_slot_day_of_week_check CHECK (day_of_week BETWEEN 0 AND 6),
        CONSTRAINT class_group_schedule_slot_time_range_check CHECK (end_time > start_time)
      )
    `);

    // Primary access pattern: "get this turma's current recurring grade"
    // (regeneration), and, joined to class_group, "which slots touch room X"
    // (ScheduleConflictDetectionService).
    await queryRunner.query(
      'CREATE INDEX class_group_schedule_slot_class_group_id_idx ON class_group_schedule_slot (class_group_id)',
    );
    // Secondary access pattern: conflict detection scans same-weekday slots
    // tenant-wide to find room/professor overlaps before persisting a new
    // or edited slot.
    await queryRunner.query(
      'CREATE INDEX class_group_schedule_slot_tenant_day_idx ON class_group_schedule_slot (tenant_id, day_of_week)',
    );

    await queryRunner.query('ALTER TABLE class_group_schedule_slot ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE class_group_schedule_slot FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON class_group_schedule_slot
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON class_group_schedule_slot TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS class_group_schedule_slot CASCADE');
  }
}
