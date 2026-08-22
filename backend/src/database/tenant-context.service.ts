import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { DataSource, EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

interface TenantStore {
  tenantId: string;
  manager: EntityManager;
}

// Holds the current request's tenant_id AND the exact transactional
// EntityManager tied to it, so repository access done through this manager
// carries the `SET LOCAL app.tenant_id` that makes RLS actually apply
// (RULE-TEN-01). A tenant_id alone isn't enough — with connection pooling,
// a plain SET on one pooled client wouldn't reliably scope to this request,
// so the whole request runs inside one transaction (see runWithTenant).
@Injectable()
export class TenantContextService {
  private readonly storage = new AsyncLocalStorage<TenantStore>();

  constructor(private readonly dataSource: DataSource) {}

  runWithTenant<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // SET LOCAL itself doesn't accept bind parameters ($1) — set_config()
      // is the parameterized equivalent, with is_local=true matching SET LOCAL's
      // transaction-scoped (not session-scoped) behavior.
      await manager.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
      return this.storage.run({ tenantId, manager }, callback);
    });
  }

  getTenantId(): string {
    return this.getStore().tenantId;
  }

  getManager(): EntityManager {
    return this.getStore().manager;
  }

  getRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>): Repository<Entity> {
    return this.getManager().getRepository(target);
  }

  private getStore(): TenantStore {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error('No tenant context set for the current request');
    }
    return store;
  }
}
