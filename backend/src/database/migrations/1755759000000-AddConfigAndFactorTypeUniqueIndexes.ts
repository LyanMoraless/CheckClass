import { MigrationInterface, QueryRunner } from 'typeorm';

// Code review finding: neither table had a uniqueness constraint backing
// the "at most one row per scope/code" assumption TenantConfigService and
// IdentificationService's CUSTOM-factor lookup both make — two concurrent
// writes could leave two rows for the same scope/code, making config
// resolution (which feeds the RULE-ATT-04/05 snapshot) non-deterministic.
// Partial indexes are needed rather than a plain UNIQUE because both
// tables have a nullable discriminator column (scope_id / tenant_id) where
// plain UNIQUE would treat every NULL as distinct from every other NULL,
// defeating the point.
export class AddConfigAndFactorTypeUniqueIndexes1755759000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX attendance_config_scoped_unique_idx
      ON attendance_config (tenant_id, scope_type, scope_id)
      WHERE scope_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX attendance_config_institution_unique_idx
      ON attendance_config (tenant_id, scope_type)
      WHERE scope_id IS NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX attendance_factor_type_tenant_code_unique_idx
      ON attendance_factor_type (tenant_id, code)
      WHERE tenant_id IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX attendance_factor_type_platform_code_unique_idx
      ON attendance_factor_type (code)
      WHERE tenant_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS attendance_factor_type_platform_code_unique_idx');
    await queryRunner.query('DROP INDEX IF EXISTS attendance_factor_type_tenant_code_unique_idx');
    await queryRunner.query('DROP INDEX IF EXISTS attendance_config_institution_unique_idx');
    await queryRunner.query('DROP INDEX IF EXISTS attendance_config_scoped_unique_idx');
  }
}
