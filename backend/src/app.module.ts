import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env-validation';
import { DatabaseModule } from './database/database.module';
import { AttendanceRegisterModule } from './modules/attendance-register/attendance-register.module';
import { AttendanceRulesModule } from './modules/attendance-rules/attendance-rules.module';
import { ClassSessionModule } from './modules/class-session/class-session.module';
import { TenantConfigModule } from './modules/config/tenant-config.module';
import { DeduplicationModule } from './modules/deduplication/deduplication.module';
import { HealthModule } from './modules/health/health.module';
import { IdentificationModule } from './modules/identification/identification.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { PendingReviewModule } from './modules/pending-review/pending-review.module';
import { QueueModule } from './queue/queue.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    // Security review finding: POST /v1/ingestion/events is reachable
    // pre-authentication (every request, valid or not, pays a DB round trip
    // through resolve_device_by_api_key_id) with no throttle at all.
    // Conservative default — real production tuning (per-device limits,
    // reverse-proxy-level throttling, etc.) is a DevOps decision, not this.
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    QueueModule,
    HealthModule,
    IngestionModule,
    IdentificationModule,
    DeduplicationModule,
    TenantConfigModule,
    ClassSessionModule,
    AttendanceRulesModule,
    PendingReviewModule,
    AttendanceRegisterModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
