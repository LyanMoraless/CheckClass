import { MigrationInterface, QueryRunner } from 'typeorm';

// Code review finding: the original UNIQUE(idempotency_key) was global
// across ALL tenants. A collision between two different tenants' devices
// (plausible with short/predictable key formats) would silently drop
// tenant B's legitimate event — RLS hides the real (tenant A) conflicting
// row from tenant B's read, so IngestionService's "look up the existing row
// to return it as a duplicate" falls through to a permanent 500 for that
// key. Scoping the constraint to (tenant_id, idempotency_key) is the actual
// fix RULE-TEN-01 requires here — a device's idempotency key only ever
// needs to be unique within its own tenant.
export class ScopeIdempotencyKeyToTenant1755758000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE raw_identification_event DROP CONSTRAINT IF EXISTS raw_identification_event_idempotency_key_key',
    );
    await queryRunner.query(`
      ALTER TABLE raw_identification_event
      ADD CONSTRAINT raw_identification_event_tenant_idempotency_key_unique UNIQUE (tenant_id, idempotency_key)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE raw_identification_event
      DROP CONSTRAINT IF EXISTS raw_identification_event_tenant_idempotency_key_unique
    `);
    await queryRunner.query(`
      ALTER TABLE raw_identification_event
      ADD CONSTRAINT raw_identification_event_idempotency_key_key UNIQUE (idempotency_key)
    `);
  }
}
