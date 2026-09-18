import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env-validation';
import { DatabaseModule } from './database/database.module';
import { AbsenceJustificationModule } from './modules/absence-justification/absence-justification.module';
import { AppCheckinModule } from './modules/app-checkin/app-checkin.module';
import { AreaAuthorizationModule } from './modules/area-authorization/area-authorization.module';
import { AreaModule } from './modules/area/area.module';
import { AttendanceFrequencyModule } from './modules/attendance-frequency/attendance-frequency.module';
import { AttendanceRegisterModule } from './modules/attendance-register/attendance-register.module';
import { AttendanceRetentionModule } from './modules/attendance-retention/attendance-retention.module';
import { AttendanceRulesModule } from './modules/attendance-rules/attendance-rules.module';
import { AuthModule } from './modules/auth/auth.module';
import { CameraModule } from './modules/camera/camera.module';
import { ClassGroupModule } from './modules/class-group/class-group.module';
import { ClassScheduleModule } from './modules/class-schedule/class-schedule.module';
import { ClassSessionModule } from './modules/class-session/class-session.module';
import { ClassMonitoringSignalModule } from './modules/class-monitoring-signal/class-monitoring-signal.module';
import { ClassroomHeadcountReconciliationModule } from './modules/classroom-headcount-reconciliation/classroom-headcount-reconciliation.module';
import { TenantConfigModule } from './modules/config/tenant-config.module';
import { CourseModule } from './modules/course/course.module';
import { DeduplicationModule } from './modules/deduplication/deduplication.module';
import { DeviceModule } from './modules/device/device.module';
import { DeviceBindingModule } from './modules/device-binding/device-binding.module';
import { DeviceIdentityModule } from './modules/device-identity/device-identity.module';
import { ExamModule } from './modules/exam/exam.module';
import { GuardianLinkFollowupModule } from './modules/guardian-link-followup/guardian-link-followup.module';
import { HealthModule } from './modules/health/health.module';
import { HolidayModule } from './modules/holiday/holiday.module';
import { IdentificationModule } from './modules/identification/identification.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { InstitutionOnboardingModule } from './modules/institution-onboarding/institution-onboarding.module';
import { InstitutionalNetworkModule } from './modules/institutional-network/institutional-network.module';
import { IntrusionDetectionModule } from './modules/intrusion-detection/intrusion-detection.module';
import { LeadershipAssignmentModule } from './modules/leadership-assignment/leadership-assignment.module';
import { LegalGuardianModule } from './modules/legal-guardian/legal-guardian.module';
import { LocationConsentModule } from './modules/location-consent/location-consent.module';
import { LocationConsentGuardModule } from './modules/location-consent-guard/location-consent-guard.module';
import { LocationVerificationModule } from './modules/location-verification/location-verification.module';
import { PendingReviewModule } from './modules/pending-review/pending-review.module';
import { PersonManagementModule } from './modules/person-management/person-management.module';
import { RoomModule } from './modules/room/room.module';
import { RoomPresenceModule } from './modules/room-presence/room-presence.module';
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
    // GuardianLinkFollowupModule/LocationConsentGuardModule before
    // PersonManagementModule reflects the real dependency direction
    // (PersonManagementModule imports both, never the reverse) —
    // registration order in this array doesn't affect Nest's DI resolution,
    // kept this way only for readability (same convention as
    // DeviceIdentityModule/DeviceBindingModule below). LegalGuardianModule
    // after PersonManagementModule for the same reason (imports it for
    // PersonMinorityStatusService — "Decisão de arquitetura — CRUD de
    // legal_guardian", architecture-overview.md).
    GuardianLinkFollowupModule,
    LocationConsentGuardModule,
    PersonManagementModule,
    LegalGuardianModule,
    // RULE-PRES-14/15 (architecture-overview.md's "Implementação —
    // location-verification e location-consent"): irmão de
    // LocationConsentGuardModule above, imports LegalGuardianModule for its
    // guardian-path integrity check — placed after it for the same
    // readability-only reasoning already used elsewhere in this array.
    LocationConsentModule,
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
    // Justificativa de Faltas (Frente 07) — depends on
    // AttendanceFrequencyModule (Controle B) already imported above, and on
    // class_group_subject_teacher (RULE-JUST-24), populated manually/by
    // script this round (no admin UI yet, out of scope by the user's own
    // decision — see pending-decisions.md).
    AbsenceJustificationModule,
    // Conformidade LGPD e retenção (Frente 10) — RULE-RET-01/02. No
    // controller: this round's actors are the unattended CLI scripts
    // (attendance-retention:close-month/:consolidate-annual) and
    // SelfServiceModule's read of AttendanceRetentionArchiveLookupService
    // (see that module's own header). Registered here purely so Nest's DI
    // container can resolve it for whichever module imports it — not because
    // any route lives here.
    AttendanceRetentionModule,
    // Frente 12 — Vínculo de Dispositivo Institucional (RULE-DEV-01..18).
    // DeviceIdentityModule before DeviceBindingModule reflects the real
    // dependency direction (device-binding consumes DeviceCredentialService,
    // never the reverse) — registration order in this array doesn't affect
    // Nest's DI resolution, kept this way only for readability.
    DeviceIdentityModule,
    // GAP-10 (RULE-DEV-14) — detecção de rede institucional. Own module
    // (own controller for the admin CRUD of ranges) so the future Frente 13
    // login-decision flow can import InstitutionalNetworkService without
    // depending on DeviceBindingModule — DeviceBindingModule already imports
    // it directly for createBinding's own use.
    InstitutionalNetworkModule,
    DeviceBindingModule,
    // RULE-PRES-01(b)/RULE-PRES-09 (architecture-overview.md's
    // "Implementação — location-verification e location-consent", wired to
    // its two intended callers in "Implementação — room-presence e
    // integração dos três gates"): same shared-stateless-primitive family as
    // InstitutionalNetworkModule above, registered here purely for DI
    // resolution — no controller of its own, no route lives here.
    LocationVerificationModule,
    // RULE-PRES-09 (architecture-overview.md's "Implementação — endpoint de
    // ingestão de raw_location_signal"): the writer half of the
    // read/write pair LocationVerificationModule/this module form —
    // LocationVerificationService reads raw_location_signal,
    // ClassMonitoringSignalService is its only writer today. Own controller
    // (POST /v1/class-monitoring-signals), so — unlike LocationVerificationModule
    // above — this one is NOT registered purely for DI resolution.
    ClassMonitoringSignalModule,
    // RULE-PRES-04/05/06/07/08 (architecture-overview.md's "Implementação —
    // room-presence e integração dos três gates"): dedicated read primitive,
    // same family as DeviceBindingModule above. Registered here purely for
    // DI resolution — no controller of its own; its write path
    // (recordFromCheckin) is invoked by DeduplicationModule, its reads by
    // AttendanceRulesModule (both import it directly too).
    RoomPresenceModule,
    // RULE-PRES-10/11/12 (Bloco 4 — Contagem por câmera como cruzamento;
    // architecture-overview.md's "Implementação —
    // classroom-headcount-reconciliation"): job de tempo, same family as
    // AttendanceRetentionModule above — no controller of its own here either.
    // Registered for DI resolution by src/scripts/classroom-headcount-
    // reconciliation-check.ts; SelfServiceModule imports it directly too, for
    // the professor's live read (GET /v1/me/class-sessions/:id/headcount-alert).
    ClassroomHeadcountReconciliationModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
