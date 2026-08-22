import { MigrationInterface, QueryRunner } from 'typeorm';

// Code review finding: PersonManagementService's find-or-create for
// actor_type had no DB-level constraint backing its "at most one row per
// (tenant, code)" assumption — two concurrent POST /v1/users calls for a
// not-yet-existing code could both insert, silently splitting one logical
// actor type across two rows.
export class AddActorTypeCodeUnique1755841000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE actor_type ADD CONSTRAINT actor_type_tenant_code_unique UNIQUE (tenant_id, code)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE actor_type DROP CONSTRAINT IF EXISTS actor_type_tenant_code_unique');
  }
}
