import { FindOperator } from 'typeorm';
import { AttendanceFrequencyWarningEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { FrequencyWarningReadService } from './frequency-warning-read.service';

// GET /v1/me/warnings' read model (RULE-FREQ-04 items 1/2/4, RULE-FREQ-08.3).
// Four behaviors carry the whole endpoint and each is easy to "simplify" into
// a bug, so each has its own test: reconcile-before-read, active-only,
// the term_end_date display filter (including the NULL branch), and the
// first-read seen_at stamp returning its PRE-update value.
describe('FrequencyWarningReadService', () => {
  function activeWarningRow(overrides: Record<string, unknown> = {}) {
    return {
      id: 'warning-1',
      classGroupId: 'class-group-1',
      classGroupName: 'Turma A',
      subjectId: 'subject-1',
      subjectName: 'Cálculo I',
      warningType: 'below_minimum',
      warningTypeSince: new Date('2026-09-01T10:00:00.000Z'),
      frequencyPercentage: 68,
      presentCount: 33,
      consideredCount: 40,
      // numeric arrives from node-pg as a string — the one conversion the
      // mapping does.
      minPercentageApplied: '75.00',
      periodStartDate: '2026-08-01',
      periodEndDate: '2026-09-30',
      seenAt: null,
      ...overrides,
    };
  }

  function buildService(rows: unknown[] = []) {
    const warningRepository = createMockRepository();
    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([[AttendanceFrequencyWarningEntity, warningRepository]]),
    );
    manager.query.mockResolvedValue(rows);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');
    const engine = { reconcileForPerson: jest.fn().mockResolvedValue(undefined) };
    const service = new FrequencyWarningReadService(tenantContext as never, engine as never);
    return { service, manager, warningRepository, engine };
  }

  // The lazy reconciliation is the reason this endpoint can exist without a
  // scheduler/cron/queue: period turnover, a config change, an edited term and
  // a late enrollment have no event of their own. Running it AFTER the read
  // would serve a stale list on exactly the reads that needed it.
  test('test_listActiveWarningsForPerson_reconcilesBeforeReading', async () => {
    const { service, manager, engine } = buildService();

    await service.listActiveWarningsForPerson('person-1');

    expect(engine.reconcileForPerson).toHaveBeenCalledWith('person-1');
    expect(engine.reconcileForPerson.mock.invocationCallOrder[0]).toBeLessThan(
      manager.query.mock.invocationCallOrder[0],
    );
  });

  test('test_listActiveWarningsForPerson_queriesByTenantAndGivenPersonIdAndActiveStatusOnly', async () => {
    const { service, manager } = buildService();

    await service.listActiveWarningsForPerson('person-1');

    const [query, parameters] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(parameters[0]).toBe('tenant-a-id');
    expect(parameters[1]).toBe('person-1');
    expect(query).toMatch(/w\.status = 'active'/);
  });

  // RULE-FREQ-08.3 addendum 3: only a term_end_date that is FILLED IN AND
  // PAST hides a warning. An absent date hides nothing — a COALESCE or an
  // `IS NOT NULL` here would let an administrator blank a field and silently
  // suppress a risk-of-reprovação alert.
  test('test_listActiveWarningsForPerson_hidesFinishedTermsButKeepsTurmaWithNoTermEndDate', async () => {
    const { service, manager } = buildService();

    await service.listActiveWarningsForPerson('person-1');

    const [query, parameters] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/cg\.term_end_date IS NULL OR cg\.term_end_date >= \$3::date/);
    expect(query).not.toMatch(/COALESCE\(cg\.term_end_date/);
    expect(query).not.toMatch(/cg\.term_end_date IS NOT NULL/);
    // Date-only parameter, so the comparison never depends on the database
    // session's timezone.
    expect(parameters[2]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // The display filter is EXHIBITION ONLY: a hidden row must not be resolved,
  // deleted or stamped. Hidden rows simply never come back from the query, so
  // the only write this service performs can only ever touch returned ids.
  test('test_listActiveWarningsForPerson_neverMutatesRowsBeyondTheFirstReadStamp', async () => {
    const { service, warningRepository } = buildService([activeWarningRow()]);

    await service.listActiveWarningsForPerson('person-1');

    expect(warningRepository.delete).not.toHaveBeenCalled();
    expect(warningRepository.save).not.toHaveBeenCalled();
    const [, values] = warningRepository.update.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(Object.keys(values)).toEqual(['seenAt']);
  });

  // RULE-FREQ-04 item 1: seen_at is stamped on the first read, and the
  // response still carries the PRE-update value — that null is what lets the
  // client tell a first-ever view from a repeat view.
  test('test_listActiveWarningsForPerson_stampsSeenAtOnFirstReadButReturnsThePreUpdateValue', async () => {
    const { service, warningRepository } = buildService([activeWarningRow({ id: 'warning-1', seenAt: null })]);

    const result = await service.listActiveWarningsForPerson('person-1');

    expect(result[0].seenAt).toBeNull();
    const [criteria, values] = warningRepository.update.mock.calls[0] as [
      { id: FindOperator<unknown> },
      { seenAt: Date },
    ];
    expect(criteria.id.type).toBe('in');
    expect(criteria.id.value).toEqual(['warning-1']);
    expect(values.seenAt).toBeInstanceOf(Date);
  });

  // seen_at records the FIRST sighting, not the latest — a row that already
  // has one is left untouched, so polling every 60s cannot keep rewriting it.
  test('test_listActiveWarningsForPerson_leavesAlreadySeenWarningsUntouched', async () => {
    const alreadySeen = new Date('2026-09-02T08:00:00.000Z');
    const { service, warningRepository } = buildService([activeWarningRow({ seenAt: alreadySeen })]);

    const result = await service.listActiveWarningsForPerson('person-1');

    expect(result[0].seenAt).toBe(alreadySeen);
    expect(warningRepository.update).not.toHaveBeenCalled();
  });

  test('test_listActiveWarningsForPerson_writesNothingWhenThereIsNoWarningToShow', async () => {
    const { service, warningRepository } = buildService([]);

    const result = await service.listActiveWarningsForPerson('person-1');

    expect(result).toEqual([]);
    expect(warningRepository.update).not.toHaveBeenCalled();
  });

  // Everything the home needs to render "33 de 40 aulas" for a named matéria
  // without a second call, with min_percentage_applied converted from the
  // string node-pg returns for `numeric`.
  test('test_listActiveWarningsForPerson_returnsRenderableRowWithNamesCountsAndNumericMinimum', async () => {
    const { service } = buildService([activeWarningRow()]);

    const [entry] = await service.listActiveWarningsForPerson('person-1');

    expect(entry).toEqual({
      id: 'warning-1',
      classGroupId: 'class-group-1',
      classGroupName: 'Turma A',
      subjectId: 'subject-1',
      subjectName: 'Cálculo I',
      warningType: 'below_minimum',
      warningTypeSince: new Date('2026-09-01T10:00:00.000Z'),
      frequencyPercentage: 68,
      presentCount: 33,
      consideredCount: 40,
      minPercentageApplied: 75,
      periodStartDate: '2026-08-01',
      periodEndDate: '2026-09-30',
      seenAt: null,
    });
  });

  // The period boundaries are calendar facts: rendered by Postgres as
  // 'YYYY-MM-DD' instead of being parsed by node-pg into a LOCAL-midnight
  // Date, which would serialize one day early outside TZ=UTC.
  test('test_listActiveWarningsForPerson_readsPeriodDatesAsDateOnlyStrings', async () => {
    const { service, manager } = buildService();

    await service.listActiveWarningsForPerson('person-1');

    const [query] = manager.query.mock.calls[0] as [string, unknown[]];
    expect(query).toMatch(/to_char\(w\.period_start_date, 'YYYY-MM-DD'\) AS "periodStartDate"/);
    expect(query).toMatch(/to_char\(w\.period_end_date, 'YYYY-MM-DD'\) AS "periodEndDate"/);
  });
});
