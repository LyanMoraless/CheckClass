import { MigrationInterface, QueryRunner } from 'typeorm';

// RULE-GRD-01/05/07 (business-rules/references/legal-guardian-consent-rules.md),
// from the schema approved by the user 2026-09-15
// ("Desenho de schema — Localização, timeout de afastamento e responsável
// legal", item 1, architecture-overview.md). Three columns on the existing
// `person` table — no new table, no enum of status.
//
// date_of_birth: nullable date. Majority (RULE-GRD-01) is ALWAYS calculated
// from this field at read time — never stored as a redundant boolean flag.
// This migration only adds the raw column; the "é menor" derivation helper
// and the read-control allowlist (RULE-GRD-05: only Secretaria reads/writes
// the raw value; everyone else gets the derived boolean) are Backend's to
// build. Nullable because existing rows have no birth date yet (RULE-GRD-07
// backfill gap) — NOT a soft "unknown = adult" default; RULE-GRD-07's soft
// block treats NULL as "block sensitive consent", enforced by Backend at the
// consent gate, not by this schema.
//
// date_of_birth_confirmed_at / date_of_birth_confirmed_by_person_id
// (RULE-GRD-07, third pending item): the two columns that let the same
// single source of truth carry the "provisório vs. confirmado
// presencialmente" state, without a separate status enum — the state is
// always derived from the combination of the three columns:
//   - date_of_birth IS NULL                          -> ausente
//   - date_of_birth set, confirmed_at IS NULL         -> provisório (autodeclarado)
//   - both set                                        -> confirmado presencialmente
// Same convention as `captured_at` on raw_location_signal/
// location_consent_decision (server clock only — never trust a client-sent
// confirmation timestamp), and the same audit convention as
// legal_guardian.registered_by_person_id for "who at the Secretaria did
// this". A single timestamp is overwritten on each new confirmation
// (precedent: legal_guardian.signature_captured_at), not append-only
// (precedent: location_consent_decision) — the Solution Architect's
// reasoning: the transition only ever moves one direction (not confirmed ->
// confirmed), so a correction counts as a new confirmation, not history to
// preserve.
export class AddPersonDateOfBirth1755873000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE person ADD COLUMN date_of_birth date');
    await queryRunner.query('ALTER TABLE person ADD COLUMN date_of_birth_confirmed_at timestamptz');
    await queryRunner.query(
      'ALTER TABLE person ADD COLUMN date_of_birth_confirmed_by_person_id uuid REFERENCES person(id)',
    );

    // Database Agent integrity decisions (not literal text of RULE-GRD-07,
    // same category as the existing raw_identification_event_origin_check
    // and personal_device_revoked_pair_check precedents — a DB-level
    // guarantee that the three columns can never drift into a nonsensical
    // combination):
    //   1. confirmed_at and confirmed_by must always be set/unset together
    //      — there is never a "confirmed by nobody" or "confirmed with no
    //      timestamp" state.
    //   2. confirmed_at can only be set once date_of_birth itself is set —
    //      the Secretaria cannot confirm a birth date that was never
    //      declared in the first place.
    await queryRunner.query(`
      ALTER TABLE person
      ADD CONSTRAINT person_date_of_birth_confirmation_pair_check
      CHECK ((date_of_birth_confirmed_at IS NULL) = (date_of_birth_confirmed_by_person_id IS NULL))
    `);
    await queryRunner.query(`
      ALTER TABLE person
      ADD CONSTRAINT person_date_of_birth_confirmation_requires_value_check
      CHECK (date_of_birth IS NOT NULL OR date_of_birth_confirmed_at IS NULL)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE person DROP CONSTRAINT IF EXISTS person_date_of_birth_confirmation_requires_value_check',
    );
    await queryRunner.query(
      'ALTER TABLE person DROP CONSTRAINT IF EXISTS person_date_of_birth_confirmation_pair_check',
    );
    await queryRunner.query('ALTER TABLE person DROP COLUMN IF EXISTS date_of_birth_confirmed_by_person_id');
    await queryRunner.query('ALTER TABLE person DROP COLUMN IF EXISTS date_of_birth_confirmed_at');
    await queryRunner.query('ALTER TABLE person DROP COLUMN IF EXISTS date_of_birth');
  }
}
