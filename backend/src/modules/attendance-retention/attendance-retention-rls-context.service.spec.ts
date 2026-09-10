import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { AttendanceRetentionRlsContextService } from './attendance-retention-rls-context.service';

// Mirrors absence-justification-rls-context.service.spec.ts's rationale:
// this GUC is the entire RLS contract attendance_closure_document's
// retention_job_scope policy (AddAttendanceRetention migration) reads.
// Pinning the exact statement catches a subtly wrong one (a session-scoped
// set_config, or an interpolated value) before it becomes a cross-request
// leak or an injection point on the setting that enforces isolation.
describe('AttendanceRetentionRlsContextService', () => {
  function buildService() {
    const manager = createMockEntityManager();
    const service = new AttendanceRetentionRlsContextService(createMockTenantContext(manager) as never);
    return { service, manager };
  }

  test('test_applyRetentionJobScope_setsMarkerAsTransactionLocal', async () => {
    const { service, manager } = buildService();

    await service.applyRetentionJobScope();

    expect(manager.query).toHaveBeenCalledWith("SELECT set_config('app.attendance_retention_job', 'on', true)");
  });

  // Transaction-local (is_local = true) matters with a connection pool: a
  // session-scoped setting would survive into the next request served by the
  // same pooled connection.
  test('test_applyRetentionJobScope_isTransactionLocalNotSessionWide', async () => {
    const { service, manager } = buildService();

    await service.applyRetentionJobScope();

    const [statement] = manager.query.mock.calls[0] as [string];
    expect(statement).toContain(', true)');
  });
});
