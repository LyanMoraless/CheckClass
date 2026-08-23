import { MigrationInterface, QueryRunner } from 'typeorm';

// Serviço de Câmeras — Cobertura de Área e Seleção Automática (Solution
// Architect decision approved 2026-08-23; hardware/control approach in
// Tech Decision item 4, same date). Per the approved tech decision, the
// backend never speaks a camera vendor protocol (no ONVIF/RTSP client/SDK
// in the NestJS monolith) — it only stores cameraId -> areaId / cameraId ->
// streamUrl metadata and tells the frontend which camera to show as the
// estimated area changes (RULE-SEC-03). Camera inventory is administered
// manually via the existing admin dashboard (no auto-discovery this
// round), which is why this is a plain standalone table, not wired into
// the device/device_api_key mechanism — cameras do not push events into
// the backend the way IR barriers/area readers do, so they need no
// device-auth credential at all.
//
// stream_url is `text`, not a bounded varchar: RTSP URLs can embed
// credentials/query parameters of unpredictable length, and there is no
// business reason to cap it.
export class AddCamera1755850000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE camera (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenant(id),
        area_id uuid NOT NULL REFERENCES area(id),
        name varchar(255) NOT NULL,
        stream_url text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Serviço de Câmeras' main read pattern: which camera(s) cover a given
    // (estimated) area.
    await queryRunner.query(`
      CREATE INDEX camera_area_id_idx ON camera (area_id)
    `);

    await queryRunner.query('ALTER TABLE camera ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE camera FORCE ROW LEVEL SECURITY');
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON camera
      USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
      WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid)
    `);

    const appDbUsername = process.env.APP_DB_USERNAME ?? 'checkclass_app';
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON camera TO ${appDbUsername}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS camera CASCADE');
  }
}
