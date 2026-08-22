import { MigrationInterface, QueryRunner } from 'typeorm';

// Platform-standard factor types (RULE-ATT-01/06), tenant_id NULL so every
// tenant sees them (RULE-ATT-13's exception, already modeled in Stage 1's
// RLS policy for this table). Codes match IngestionEventType 1:1 for the
// event types the Identification service resolves directly; CAMERA_COUNT
// is included for completeness (RULE-ATT-01 lists camera/count as a factor)
// even though it doesn't produce an identification_checkin (aggregate, not
// per-person).
export class SeedStandardAttendanceFactorTypes1755754000000 implements MigrationInterface {
  private readonly standardFactors: Array<{ code: string; name: string }> = [
    { code: 'TAG_CHECKIN', name: 'Tag/proximity check-in' },
    { code: 'FACIAL_CHECKIN', name: 'Facial recognition check-in' },
    { code: 'ROOM_ENTRY', name: 'Room entry' },
    { code: 'ROOM_EXIT', name: 'Room exit' },
    { code: 'CAMERA_COUNT', name: 'Camera people count' },
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const factor of this.standardFactors) {
      await queryRunner.query(
        `INSERT INTO attendance_factor_type (tenant_id, code, name, is_custom) VALUES (NULL, $1, $2, false)`,
        [factor.code, factor.name],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM attendance_factor_type WHERE tenant_id IS NULL AND code = ANY($1)`,
      [this.standardFactors.map((f) => f.code)],
    );
  }
}
