import { MigrationInterface, QueryRunner } from 'typeorm';

// Gateway de Ingestão de Sinais de Segurança (Solution Architect decision
// approved 2026-08-23): deliberately a SEPARATE raw-event table from
// raw_identification_event — that table and its consumers (Identificação,
// Deduplicação, Motor de Regras de Presença) are specific to the attendance
// pipeline and are not touched by this migration. Mirrors
// raw_identification_event's shape where the two domains genuinely overlap
// (tenant-scoped, device-authenticated, idempotency-keyed, jsonb raw
// payload) and diverges where the approved contracts differ:
//   - device_id is always NOT NULL here (Tech Decision item 3: security
//     signals are always device-authenticated; there is no app-originated
//     equivalent of APP_CHECKIN in this domain), so no nullable-origin
//     CHECK constraint is needed like raw_identification_event's.
//   - idempotency_key is tenant-scoped UNIQUE from the start (tenant_id,
//     idempotency_key) — raw_identification_event only got this fix later
//     (ScopeIdempotencyKeyToTenant), after a cross-tenant collision was
//     found in review; no reason to reintroduce that bug here.
//   - captured_at is promoted to a real indexed column from day one,
//     instead of living only inside raw_payload (the still-open, explicitly
//     non-blocking question for raw_identification_event in
//     pending-decisions.md). Here it is not optional: the Motor de Detecção
//     de Intrusão must correlate/order signals into a single incident's
//     location-history trail (RULE-SEC-02), which needs a sortable,
//     indexable timestamp from the start — this is a justified deviation
//     for this table's specific consumer, not a blanket default.
//   - area_id is NOT NULL, per the approved payload envelope (Tech Decision
//     item 3: `{ idempotencyKey, eventType, capturedAt, areaId, data }` —
//     areaId is part of the common envelope for both event types, not
//     per-type data).
export class AddRawSecurityEvent1755848000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE raw_security_event (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        device_id uuid NOT NULL REFERENCES device(id),
        event_type varchar(30) NOT NULL,
        area_id uuid NOT NULL REFERENCES area(id),
        captured_at timestamptz NOT NULL,
        idempotency_key varchar(255) NOT NULL,
        raw_payload jsonb NOT NULL,
        received_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT raw_security_event_tenant_idempotency_key_unique UNIQUE (tenant_id, idempotency_key),
        CONSTRAINT raw_security_event_type_check
          CHECK (event_type IN ('IR_BARRIER_CROSSING', 'AREA_READER_SCAN'))
      )
    `);

    // Motor de Detecção de Intrusão's main read pattern: recent signals for
    // a given area, in capture order.
    await queryRunner.query(`
      CREATE INDEX raw_security_event_area_captured_at_idx ON raw_security_event (area_id, captured_at)
    `);

    await queryRunner.query('ALTER TABLE raw_security_event ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE raw_security_event FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON raw_security_event
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON raw_security_event TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS raw_security_event CASCADE');
  }
}
