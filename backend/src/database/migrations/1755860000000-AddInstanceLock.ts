import { MigrationInterface, QueryRunner } from 'typeorm';

// Security-review follow-up on RULE-INST-02's single-instance onboarding
// lock: InstitutionOnboardingService previously enforced "only one
// institution per instance" with a plain SELECT COUNT(*) FROM tenant check
// before creating a tenant — a check-then-act race, since nothing in
// Postgres actually serialized two concurrent onboarding requests against
// each other. This table is the standard Postgres "singleton row" pattern: a
// primary key that can only ever hold the value `true`, so a second
// concurrent INSERT is rejected by the primary key constraint itself
// (23505), not by application-level timing. No RLS — this is pre-tenant,
// instance-wide state, same as `tenant` itself (see InitSchema's own
// comment on why `tenant` has no RLS policy).
export class AddInstanceLock1755860000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE instance_lock (
        id boolean PRIMARY KEY DEFAULT true,
        locked_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT instance_lock_single_row CHECK (id)
      )
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, DELETE ON instance_lock TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS instance_lock');
  }
}
