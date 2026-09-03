import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { ExamRlsContextService } from './exam-rls-context.service';

// The AddExamArea migration's RLS contract: four exam tables are fail-closed
// and read two GUCs TenantContextService does not set. These tests pin the
// exact statements, because getting them subtly wrong (a session-scoped
// set_config, or an interpolated person id) would either leak across
// requests or open an injection point on the very setting that enforces
// isolation.
describe('ExamRlsContextService', () => {
  function buildService() {
    const manager = createMockEntityManager();
    const service = new ExamRlsContextService(createMockTenantContext(manager) as never);
    return { service, manager };
  }

  test('test_applyStudentScope_setsPersonIdAsTransactionLocalBoundParameter', async () => {
    const { service, manager } = buildService();

    await service.applyStudentScope('student-1');

    expect(manager.query).toHaveBeenCalledWith("SELECT set_config('app.person_id', $1, true)", ['student-1']);
  });

  test('test_applyManagementScope_setsMarkerAsTransactionLocal', async () => {
    const { service, manager } = buildService();

    await service.applyManagementScope();

    expect(manager.query).toHaveBeenCalledWith("SELECT set_config('app.exam_management_scope', 'on', true)");
  });

  // Transaction-local (is_local = true) matters with a connection pool: a
  // session-scoped setting would survive into the next request served by the
  // same pooled connection.
  test('test_bothScopes_areTransactionLocalNotSessionWide', async () => {
    const { service, manager } = buildService();

    await service.applyStudentScope('student-1');
    await service.applyManagementScope();

    for (const call of manager.query.mock.calls) {
      expect(call[0]).toContain(', true)');
    }
  });
});
