import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Job, PgBoss, SendOptions } from 'pg-boss';
import { EntityManager } from 'typeorm';

// Internal durable queue (approved tech decision: transactional outbox over
// Postgres via pg-boss, no external broker — volume doesn't justify one yet).
// Runs under the unprivileged checkclass_app role, in its own `pgboss`
// schema (see SetupQueueSchema migration) — separate from the tenant-scoped
// domain tables, so it needs no RLS policy of its own.
//
// Builds its own readiness promise in the constructor (not an onModuleInit
// hook) so callers never have to reason about cross-module lifecycle
// ordering: awaiting `this.ready` is correct no matter when a consumer
// (e.g. IdentificationWorker) happens to be instantiated relative to this
// service.
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly ready: Promise<PgBoss>;

  constructor(config: ConfigService) {
    this.ready = this.start(config);
  }

  private async start(config: ConfigService): Promise<PgBoss> {
    // pg-boss ships ESM-only (no CJS build). tsc's CommonJS output downlevels
    // a normal `await import(...)` to `Promise.resolve().then(() => require(...))`
    // — still a synchronous require() under the hood, which hangs loading an
    // ESM-only package. Routing the import through `new Function` hides it
    // from tsc's static transform, so this stays a genuine dynamic import at
    // runtime. `import type` above is compile-time only, no require() emitted.
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (specifier: string) => Promise<typeof import('pg-boss')>;
    const { PgBoss: PgBossCtor } = await dynamicImport('pg-boss');
    const boss = new PgBossCtor({
      host: config.get<string>('DB_HOST'),
      port: config.get<number>('DB_PORT'),
      database: config.get<string>('DB_DATABASE'),
      user: config.get<string>('APP_DB_USERNAME'),
      password: config.get<string>('APP_DB_PASSWORD'),
      schema: 'pgboss',
    });
    boss.on('error', (error: Error) => this.logger.error(error));
    await boss.start();
    return boss;
  }

  async onModuleDestroy(): Promise<void> {
    const boss = await this.ready;
    await boss.stop({ graceful: false });
  }

  // Enqueues through `manager`'s own connection/transaction, so the job is
  // only ever durable if that transaction commits — the actual transactional
  // outbox guarantee, not just "queue it and hope the process doesn't crash
  // between the DB commit and the enqueue call".
  async sendWithManager(name: string, data: object, manager: EntityManager): Promise<void> {
    const boss = await this.ready;
    const options: SendOptions = {
      db: {
        executeSql: async (text: string, values?: unknown[]) => ({ rows: await manager.query(text, values) }),
      },
    };
    await boss.send(name, data, options);
  }

  async work<T extends object>(name: string, handler: (data: T) => Promise<void>): Promise<void> {
    const boss = await this.ready;
    await boss.createQueue(name);
    await boss.work<T>(name, async (jobs: Job<T>[]) => {
      for (const job of jobs) {
        await handler(job.data);
      }
    });
  }
}
