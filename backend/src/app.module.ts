import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env-validation';
import { DatabaseModule } from './database/database.module';
import { AppCheckinModule } from './modules/app-checkin/app-checkin.module';
import { AreaAuthorizationModule } from './modules/area-authorization/area-authorization.module';
import { AreaModule } from './modules/area/area.module';
import { AttendanceFrequencyModule } from './modules/attendance-frequency/attendance-frequency.module';
import { AttendanceRegisterModule } from './modules/attendance-register/attendance-register.module';
import { AttendanceRulesModule } from './modules/attendance-rules/attendance-rules.module';
import { AuthModule } from './modules/auth/auth.module';
import { CameraModule } from './modules/camera/camera.module';
import { ClassGroupModule } from './modules/class-group/class-group.module';
import { ClassScheduleModule } from './modules/class-schedule/class-schedule.module';
import { ClassSessionModule } from './modules/class-session/class-session.module';
import { TenantConfigModule } from './modules/config/tenant-config.module';
import { CourseModule } from './modules/course/course.module';
import { DeduplicationModule } from './modules/deduplication/deduplication.module';
import { DeviceModule } from './modules/device/device.module';
import { ExamModule } from './modules/exam/exam.module';
import { HealthModule } from './modules/health/health.module';
import { HolidayModule } from './modules/holiday/holiday.module';
import { IdentificationModule } from './modules/identification/identification.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { InstitutionOnboardingModule } from './modules/institution-onboarding/institution-onboarding.module';
import { IntrusionDetectionModule } from './modules/intrusion-detection/intrusion-detection.module';
import { LeadershipAssignmentModule } from './modules/leadership-assignment/leadership-assignment.module';
import { PendingReviewModule } from './modules/pending-review/pending-review.module';
import { PersonManagementModule } from './modules/person-management/person-management.module';
import { RoomModule } from './modules/room/room.module';
import { ScheduleConflictDetectionModule } from './modules/schedule-conflict-detection/schedule-conflict-detection.module';
import { SecurityIncidentModule } from './modules/security-incident/security-incident.module';
import { SecurityIngestionModule } from './modules/security-ingestion/security-ingestion.module';
import { SelfServiceModule } from './modules/self-service/self-service.module';
import { StudentDirectoryModule } from './modules/student-directory/student-directory.module';
import { SubjectModule } from './modules/subject/subject.module';
import { WristbandModule } from './modules/wristband/wristband.module';
import { WristbandIdentityModule } from './modules/wristband-identity/wristband-identity.module';
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
    // Controle B (Frente 06) sits between Controle A and its consumers on
    // purpose: PendingReviewModule below depends on it, never the reverse.
    AttendanceFrequencyModule,
    PendingReviewModule,
    AttendanceRegisterModule,
    AuthModule,
    InstitutionOnboardingModule,
    PersonManagementModule,
    StudentDirectoryModule,
    CourseModule,
    SubjectModule,
    RoomModule,
    AreaModule,
    ClassGroupModule,
    LeadershipAssignmentModule,
    HolidayModule,
    ScheduleConflictDetectionModule,
    ClassScheduleModule,
    WristbandModule,
    DeviceModule,
    SelfServiceModule,
    AppCheckinModule,
    // Segurança de Intrusão, primeira rodada (RULE-SEC-01/02/03/07) — a
    // second, structurally parallel event-driven pipeline, sharing only the
    // WristbandIdentityModule primitive with the attendance pipeline above.
    WristbandIdentityModule,
    AreaAuthorizationModule,
    SecurityIngestionModule,
    IntrusionDetectionModule,
    SecurityIncidentModule,
    CameraModule,
    // Área de Provas (Frente 04) — synchronous bounded context, no queue
    // involvement at all (approved architecture, 2026-09-02).
    ExamModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
