import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-INST-02 (institution-management-rules.md): the public self-service
// onboarding screen must collect, at minimum, institution name (already
// existed), CNPJ, and address (street/number/neighborhood/city/state
// required, complement optional, filled from CEP via ViaCEP or manually if
// ViaCEP fails/is unavailable).
//
// These columns are added NULLABLE at the database level, deliberately not
// enforced NOT NULL here: two tenant-creation paths coexist per the
// approved architecture (architecture-overview.md, "Decisão de arquitetura
// — Gerenciamento da Instituição") — the new public onboarding controller
// (which will validate these as required via its own DTO) and the
// pre-existing TenantBootstrapService/tenant-create.ts CLI script, kept
// exclusively for test/CI environments per RULE-INST-02's second-round
// update, which does not (and per that architecture decision, should not
// have to) supply them. Requiredness is therefore an application-layer
// (onboarding DTO) concern, not a blanket database invariant — mirrors how
// RULE-INST-02's "trava de instância única" is also implemented as
// application logic, not a DB constraint.
//
// CNPJ gets a format CHECK (14 digits) as a baseline DB-level integrity
// guard, but NOT the check-digit (dígito verificador) algorithm itself —
// RULE-INST-02's second-round update explicitly assigns that calculation to
// the Backend Agent's application-level validation, not the schema.
export class AddTenantInstitutionProfile1755852000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tenant
      ADD COLUMN cnpj varchar(14),
      ADD COLUMN address_street varchar(255),
      ADD COLUMN address_number varchar(20),
      ADD COLUMN address_complement varchar(255),
      ADD COLUMN address_neighborhood varchar(255),
      ADD COLUMN address_city varchar(255),
      ADD COLUMN address_state varchar(2),
      ADD COLUMN address_zip_code varchar(8)
    `);

    await queryRunner.query(`
      ALTER TABLE tenant
      ADD CONSTRAINT tenant_cnpj_format_check CHECK (cnpj IS NULL OR cnpj ~ '^[0-9]{14}$')
    `);

    // Multiple NULLs are allowed by a UNIQUE constraint in Postgres, so this
    // does not block tenants created before CNPJ existed or via the CLI/test
    // path above — it only blocks two tenants sharing the same non-null CNPJ.
    await queryRunner.query('ALTER TABLE tenant ADD CONSTRAINT tenant_cnpj_unique UNIQUE (cnpj)');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_cnpj_unique');
    await queryRunner.query('ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_cnpj_format_check');
    await queryRunner.query(`
      ALTER TABLE tenant
      DROP COLUMN IF EXISTS address_zip_code,
      DROP COLUMN IF EXISTS address_state,
      DROP COLUMN IF EXISTS address_city,
      DROP COLUMN IF EXISTS address_neighborhood,
      DROP COLUMN IF EXISTS address_complement,
      DROP COLUMN IF EXISTS address_number,
      DROP COLUMN IF EXISTS address_street,
      DROP COLUMN IF EXISTS cnpj
    `);
  }
}
