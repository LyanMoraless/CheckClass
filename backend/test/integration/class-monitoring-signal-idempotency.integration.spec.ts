import { Client } from 'pg';
import { DataSource } from 'typeorm';
import { TenantContextService } from '../../src/database/tenant-context.service';
import { ClassMonitoringSignalService } from '../../src/modules/class-monitoring-signal/class-monitoring-signal.service';
import { ReportClassMonitoringSignalDto } from '../../src/modules/class-monitoring-signal/dto/report-class-monitoring-signal.dto';
import { cleanupTenants, createAppDataSource, createSuperuserClient, createTenantWithPerson, TenantFixture } from './support/db';

// RULE-PRES-09 — raw_location_signal's own idempotency guarantee
// (AddRawLocationSignal migration: UNIQUE (tenant_id, idempotency_key),
// consumed via INSERT ... ON CONFLICT DO NOTHING in
// ClassMonitoringSignalService.report) verified against the real unique
// constraint, complementing the mocked-manager unit spec
// (class-monitoring-signal.service.spec.ts). Same resend-tolerance family as
// AppCheckinService.submit / IngestionService.ingest — a mobile client
// retrying a POST after a dropped response must never create a second row.
describe('ClassMonitoringSignalService.report idempotency (real Postgres)', () => {
  let superuser: Client;
  let dataSource: DataSource;
  let tenantContext: TenantContextService;
  let tenant: TenantFixture;
  let classSessionId: string;

  beforeAll(async () => {
    superuser = createSuperuserClient();
    await superuser.connect();
    tenant = await createTenantWithPerson(superuser, 'ClassMonitoringIdem');

    const courseResult = await superuser.query(`INSERT INTO course (tenant_id, name) VALUES ($1, 'Course') RETURNING id`, [
      tenant.tenantId,
    ]);
    const classGroupResult = await superuser.query(
      `INSERT INTO class_group (tenant_id, course_id, name) VALUES ($1, $2, 'Class Group') RETURNING id`,
      [tenant.tenantId, courseResult.rows[0].id],
    );
    await superuser.query(`INSERT INTO class_group_enrollment (tenant_id, class_group_id, person_id, role) VALUES ($1, $2, $3, 'student')`, [
      tenant.tenantId,
      classGroupResult.rows[0].id,
      tenant.personId,
    ]);
    const roomResult = await superuser.query(`INSERT INTO room (tenant_id, name) VALUES ($1, 'Room 1') RETURNING id`, [
      tenant.tenantId,
    ]);
    const classSessionResult = await superuser.query(
      `INSERT INTO class_session (
         tenant_id, class_group_id, room_id, scheduled_start, scheduled_end,
         min_attendance_percentage_snapshot, tolerance_minutes_snapshot, post_tolerance_behavior_snapshot
       ) VALUES ($1, $2, $3, now() - interval '1 hour', now() + interval '1 hour', 75, 15, 'accept_without_counting')
       RETURNING id`,
      [tenant.tenantId, classGroupResult.rows[0].id, roomResult.rows[0].id],
    );
    classSessionId = classSessionResult.rows[0].id as string;

    dataSource = createAppDataSource();
    await dataSource.initialize();
    tenantContext = new TenantContextService(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
    await cleanupTenants(superuser, [tenant.tenantId]);
    await superuser.end();
  });

  function buildDto(idempotencyKey: string): ReportClassMonitoringSignalDto {
    const dto = new ReportClassMonitoringSignalDto();
    dto.idempotencyKey = idempotencyKey;
    dto.classSessionId = classSessionId;
    dto.latitude = -23.561;
    dto.longitude = -46.655;
    dto.accuracyMeters = 10;
    dto.isMocked = false;
    return dto;
  }

  test('test_report_duplicateIdempotencyKey_returnsExistingSignalInsteadOfInsertingSecondRow', async () => {
    const service = new ClassMonitoringSignalService(tenantContext);
    const idempotencyKey = `idem-class-monitoring-${Date.now()}-${Math.random()}`;

    const first = await tenantContext.runWithTenant(tenant.tenantId, () => service.report(tenant.personId, buildDto(idempotencyKey)));
    const second = await tenantContext.runWithTenant(tenant.tenantId, () => service.report(tenant.personId, buildDto(idempotencyKey)));

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.signalId).toBe(first.signalId);

    const rows = await superuser.query('SELECT id FROM raw_location_signal WHERE idempotency_key = $1', [idempotencyKey]);
    expect(rows.rows).toHaveLength(1);
  });

  test('test_report_differentIdempotencyKeys_createsSeparateRowsForEach', async () => {
    const service = new ClassMonitoringSignalService(tenantContext);
    const keyOne = `idem-class-monitoring-${Date.now()}-${Math.random()}`;
    const keyTwo = `idem-class-monitoring-${Date.now()}-${Math.random()}`;

    const first = await tenantContext.runWithTenant(tenant.tenantId, () => service.report(tenant.personId, buildDto(keyOne)));
    const second = await tenantContext.runWithTenant(tenant.tenantId, () => service.report(tenant.personId, buildDto(keyTwo)));

    expect(first.created).toBe(true);
    expect(second.created).toBe(true);
    expect(first.signalId).not.toBe(second.signalId);
  });
});
