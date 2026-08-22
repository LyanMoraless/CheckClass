// Shared mocking helpers for unit specs under src/modules/**/*.spec.ts.
// Every rules-engine-adjacent service in this codebase reaches the database
// exclusively through TenantContextService.getManager()/getTenantId() (see
// tenant-context.service.ts) — mocking that one seam is enough to unit-test
// the decision logic without a real Postgres connection.

export interface MockRepository {
  findOneBy: jest.Mock;
  findOneByOrFail: jest.Mock;
  findBy: jest.Mock;
  find: jest.Mock;
  create: jest.Mock;
  save: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
}

export function createMockRepository(overrides: Partial<MockRepository> = {}): MockRepository {
  return {
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
    ...overrides,
  };
}

export interface MockEntityManager {
  query: jest.Mock;
  getRepository: jest.Mock;
}

// entity -> mock repository. Keyed by the actual entity class reference, the
// same value services pass to manager.getRepository(SomeEntity).
export function createMockEntityManager(repositoriesByEntity: Map<unknown, MockRepository> = new Map()): MockEntityManager {
  return {
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
  };
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
