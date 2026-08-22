import { MigrationInterface, QueryRunner } from 'typeorm';

// pg-boss (approved tech decision: internal durable queue via transactional
// outbox over Postgres, no external broker) manages its own schema/tables.
// It runs under the unprivileged checkclass_app role at app startup, so that
// role needs rights to create/own objects in a dedicated `pgboss` schema —
// granted narrowly here rather than opening up `public`.
export class SetupQueueSchema1755753000000 implements MigrationInterface {
  private readonly appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`GRANT CREATE ON DATABASE ${queryRunner.connection.options.database} TO ${this.appDbUsername}`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS pgboss AUTHORIZATION ${this.appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SCHEMA IF EXISTS pgboss CASCADE');
    await queryRunner.query(`REVOKE CREATE ON DATABASE ${queryRunner.connection.options.database} FROM ${this.appDbUsername}`);
  }
}
