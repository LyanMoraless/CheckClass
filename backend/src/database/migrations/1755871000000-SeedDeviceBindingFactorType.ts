import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-DEV-12 (addendum to RULE-ATT-02, business-rules/references/
// institutional-device-binding-rules.md): "vínculo de dispositivo
// institucional" enters the normal list of configurable attendance factors,
// exactly like a platform-standard factor — tenant_id NULL, same shape and
// same RLS exception already modeled by SeedStandardAttendanceFactorTypes.
// Its own migration (not appended to that one) for the same reason
// SeedAppCheckinFactorType got its own: this factor is tied to a distinct,
// later capability (device-binding module), not the original device-
// ingestion factor set.
export class SeedDeviceBindingFactorType1755871000000 implements MigrationInterface {
  private readonly code = 'DEVICE_BINDING';
  private readonly factorName = 'Institutional device binding';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO attendance_factor_type (tenant_id, code, name, is_custom) VALUES (NULL, $1, $2, false)`,
      [this.code, this.factorName],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM attendance_factor_type WHERE tenant_id IS NULL AND code = $1`, [
      this.code,
    ]);
  }
}
