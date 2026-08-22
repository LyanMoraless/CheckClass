import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entities from './entities';
import { TenantContextService } from './tenant-context.service';

// Global: every feature module needs DataSource + TenantContextService to
// read/write tenant-scoped data (RULE-TEN-01), so requiring each of them to
// re-import this module would just be repetitive boilerplate.
@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        // Runtime traffic uses the unprivileged app role, never the migration
        // superuser — RLS-based tenant isolation only holds against a role
        // without BYPASSRLS (see InitSchema migration).
        username: config.get<string>('APP_DB_USERNAME'),
        password: config.get<string>('APP_DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        entities: Object.values(entities),
        synchronize: false,
        migrationsRun: false,
      }),
    }),
  ],
  providers: [TenantContextService],
  exports: [TypeOrmModule, TenantContextService],
})
export class DatabaseModule {}
