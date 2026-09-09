import { createMockEntityManager, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { AbsenceJustificationRlsContextService } from './absence-justification-rls-context.service';

// Mirrors exam-rls-context.service.spec.ts's rationale: this module's four
// GUCs (app.person_id, app.absence_justification_retention_job,
// app.absence_justification_access_log_scope on/off) are the entire RLS
// contract every table's policy in the AddAbsenceJustification /
// AddAbsenceJustificationAccessLogLookupScope migrations reads. Pinning the
// exact statements here catches a subtly wrong one (a session-scoped
// set_config, or an interpolated value) before it becomes a cross-request
// leak or an injection point on the setting that enforces isolation.
describe('AbsenceJustificationRlsContextService', () => {
  function buildService() {
    const manager = createMockEntityManager();
    const service = new AbsenceJustificationRlsContextService(createMockTenantContext(manager) as never);
    return { service, manager };
  }

  test('test_applyPersonScope_setsPersonIdAsTransactionLocalBoundParameter', async () => {
    const { service, manager } = buildService();

    await service.applyPersonScope('student-1');

    expect(manager.query).toHaveBeenCalledWith("SELECT set_config('app.person_id', $1, true)", ['student-1']);
  });

  test('test_applyRetentionJobScope_setsMarkerAsTransactionLocal', async () => {
    const { service, manager } = buildService();

    await service.applyRetentionJobScope();

    expect(manager.query).toHaveBeenCalledWith(
      "SELECT set_config('app.absence_justification_retention_job', 'on', true)",
    );
  });

  test('test_applyAccessLogLookupScope_turnsMarkerOnAsTransactionLocal', async () => {
    const { service, manager } = buildService();

    await service.applyAccessLogLookupScope();

    expect(manager.query).toHaveBeenCalledWith(
      "SELECT set_config('app.absence_justification_access_log_scope', 'on', true)",
    );
  });

  // Load-bearing for AbsenceJustificationAttachmentService.download()'s
  // `finally` block: the elevated door must be provably turned back OFF, not
  // merely left to expire — a wrong value here (e.g. leaving it 'on') would
  // silently widen every subsequent query in the same transaction.
  test('test_clearAccessLogLookupScope_turnsMarkerOffAsTransactionLocal', async () => {
    const { service, manager } = buildService();

    await service.clearAccessLogLookupScope();

    expect(manager.query).toHaveBeenCalledWith(
      "SELECT set_config('app.absence_justification_access_log_scope', 'off', true)",
    );
  });

  // Transaction-local (is_local = true) matters with a connection pool: a
  // session-scoped setting would survive into the next request served by the
  // same pooled connection — same invariant ExamRlsContextService's own spec
  // pins for its two GUCs.
  test('test_allFourCalls_areTransactionLocalNotSessionWide', async () => {
    const { service, manager } = buildService();

    await service.applyPersonScope('student-1');
    await service.applyRetentionJobScope();
    await service.applyAccessLogLookupScope();
    await service.clearAccessLogLookupScope();

    for (const call of manager.query.mock.calls) {
      expect(call[0]).toContain(', true)');
    }
  });
});
