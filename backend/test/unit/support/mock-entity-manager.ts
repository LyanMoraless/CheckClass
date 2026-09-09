// Shared mocking helpers for unit specs under src/modules/**/*.spec.ts.
// Every rules-engine-adjacent service in this codebase reaches the database
// exclusively through TenantContextService.getManager()/getTenantId() (see
// tenant-context.service.ts) — mocking that one seam is enough to unit-test
// the decision logic without a real Postgres connection.

export interface MockRepository {
  findOne: jest.Mock;
  findOneBy: jest.Mock;
  findOneByOrFail: jest.Mock;
  findBy: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
  // repository-level createQueryBuilder(alias) — as opposed to the
  // manager-level one on MockEntityManager below. TypeORM exposes both, and
  // both are genuinely used in this codebase (e.g.
  // AbsenceJustificationNoticeReadService.listMine /
  // AbsenceJustificationAttachmentService.sweepDueAttachments call the
  // repository-level one). Not pre-wired to any builder by default — tests
  // that need it call `.mockReturnValue(createMockSelectQueryBuilder(rows))`
  // themselves, same posture as MockEntityManager.createQueryBuilder.
  createQueryBuilder: jest.Mock;
}

export function createMockRepository(overrides: Partial<MockRepository> = {}): MockRepository {
  return {
    // Standing in for both a plain findOne(...) and a locked one (e.g.
    // RefreshTokenService.lockById's `{ where, lock: { mode: 'pessimistic_write' } }`)
    // — the mock doesn't distinguish, since locking is a real-Postgres-only
    // concern no unit-level mock can meaningfully simulate anyway.
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    findOneByOrFail: jest.fn(),
    findBy: jest.fn().mockResolvedValue([]),
    find: jest.fn().mockResolvedValue([]),
    // TypeORM's repository.create() just builds a plain entity-shaped object
    // from its input — returning the input as-is is a faithful enough stand-in.
    create: jest.fn((entityLike: unknown) => entityLike),
    save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
    ...overrides,
  };
}

export interface MockEntityManager {
  query: jest.Mock;
  getRepository: jest.Mock;
  createQueryBuilder: jest.Mock;
  transaction: jest.Mock;
}

// Chainable stand-in for manager.createQueryBuilder().insert().into(...)
// .values(...).orIgnore().returning([...]).execute() — the "insert, or do
// nothing on conflict" pattern used by IngestionService/IdentificationService
// and now PersonManagementService's find-or-create. `insertedId` controls
// what execute() resolves to: a real id simulates a successful insert, null
// simulates losing the race (orIgnore triggered, identifiers[0] has no id).
export function createMockInsertQueryBuilder(insertedId: string | null) {
  const builder = {
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    returning: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue({ identifiers: [insertedId ? { id: insertedId } : {}] }),
  };
  return builder;
}

// entity -> mock repository. Keyed by the actual entity class reference, the
// same value services pass to manager.getRepository(SomeEntity).
export function createMockEntityManager(repositoriesByEntity: Map<unknown, MockRepository> = new Map()): MockEntityManager {
  const manager: MockEntityManager = {
    query: jest.fn().mockResolvedValue([]),
    getRepository: jest.fn((entity: unknown) => {
      const repository = repositoriesByEntity.get(entity);
      if (!repository) {
        throw new Error(
          `No mock repository registered for entity ${String(entity)} in this test — register one via the repositoriesByEntity map`,
        );
      }
      return repository;
    }),
    // Default: simulates a fresh successful insert. Override per-test via
    // manager.createQueryBuilder.mockReturnValue(createMockInsertQueryBuilder(null))
    // to simulate the orIgnore/losing-the-race path instead.
    createQueryBuilder: jest.fn().mockReturnValue(createMockInsertQueryBuilder('inserted-id')),
    // Faithful enough for unit-level decision-logic coverage: just runs the
    // callback against this same mock manager, with no real
    // SAVEPOINT/ROLLBACK TO SAVEPOINT semantics — that transaction-abort
    // recovery behavior (IntrusionDetectionService.openNewIncident) is only
    // meaningfully verified against a real Postgres connection, see the
    // integration spec for that.
    transaction: jest.fn((callback: (manager: MockEntityManager) => Promise<unknown>) => callback(manager)),
  };
  return manager;
}

// Chainable stand-in for manager.createQueryBuilder('alias').where(...)
// .andWhere(...).orderBy(...).getMany() — the plain SELECT-filter-order
// pattern (as opposed to createMockInsertQueryBuilder's insert/orIgnore
// shape above). `rows` controls what getMany() resolves to; every chain
// method returns `this` regardless of call count/order, so callers do not
// need to know exactly how many `.andWhere(...)` calls the production code
// makes.
export function createMockSelectQueryBuilder(rows: unknown[] = []) {
  const builder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
  };
  return builder;
}

export interface MockTenantContext {
  getManager: jest.Mock;
  getTenantId: jest.Mock;
}

export function createMockTenantContext(manager: MockEntityManager, tenantId = 'tenant-a-id'): MockTenantContext {
  return {
    getManager: jest.fn().mockReturnValue(manager),
    getTenantId: jest.fn().mockReturnValue(tenantId),
  };
}
