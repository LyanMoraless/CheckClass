import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { FrequencyWarningReadService } from '../attendance-frequency/frequency-warning-read.service';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CoordinatedClassGroupsService } from './coordinated-class-groups.service';
import { MeClassGroupAttendanceService } from './me-class-group-attendance.service';
import { MeClassSessionHeadcountAlertService } from './me-class-session-headcount-alert.service';
import { MeContextService } from './me-context.service';
import { MePersonAttendanceService } from './me-person-attendance.service';
import { MyScheduleService } from './my-schedule.service';
import { TeachingClassGroupsService } from './teaching-class-groups.service';

// RULE-ATT-15: any authenticated person can always read their OWN
// consolidated attendance/schedule, independent of permission-group
// membership. Deliberately a SEPARATE route family from the admin-facing
// GET /v1/register/... (AttendanceRegisterController) — not a retrofit of
// those routes, which stay permission-gated and unchanged.
//
// Guarded by JwtAuthGuard + TenantContextInterceptor ONLY: no
// PermissionCheckInterceptor/@RequirePermission at all. "Is this MY OWN
// data" is a structurally different authorization question from the
// permission-group system (manage_users / configure_attendance_rules /
// view_attendance_register / manage_institution_structure, all
// admin/staff-profile grants over *anyone's* data) — it's not one more
// permission to hold, it's unconditional for any authenticated person per
// RULE-ATT-15.
//
// personId is NEVER accepted as a route/query/body param here — it comes
// exclusively from request.personId, set by JwtAuthGuard from the verified
// JWT, so it can never be spoofed to read someone else's data (same idiom
// PendingReviewController.resolve() already uses for resolvingPersonId).
//
// Portal de Autoatendimento web (architecture-overview.md, "Decisão de
// arquitetura — Portal de Autoatendimento Web, estrutura"): context() below
// adds a second authorization idiom to this same controller — a read scoped
// not to "my own data" but to "data of turmas within my leadership chain"
// (classGroupAttendance()). Still deliberately outside the permission-group
// system, for the same reason RULE-ATT-12 already put pending-review
// resolution there: leadership scope isn't a grant over "anyone's" data,
// it's bounded to the turmas/courses this specific person leads.
@Controller('v1/me')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class MeController {
  constructor(
    private readonly personAttendanceService: MePersonAttendanceService,
    private readonly scheduleService: MyScheduleService,
    private readonly contextService: MeContextService,
    private readonly teachingClassGroupsService: TeachingClassGroupsService,
    private readonly coordinatedClassGroupsService: CoordinatedClassGroupsService,
    private readonly classGroupAttendanceService: MeClassGroupAttendanceService,
    private readonly warningReadService: FrequencyWarningReadService,
    private readonly headcountAlertService: MeClassSessionHeadcountAlertService,
  ) {}

  // Frente 10 (RULE-RET-01 mobile-app note, confirmed 2026-08-22): a session
  // older than the 60-day live window reads as `archived: true`, never as if
  // it had simply never happened — see MePersonAttendanceService for how
  // that distinction is made.
  //
  // CURRENTLY UNREACHABLE (Project Guardian, 2026-09-10): `archived: true`
  // never fires today — attendance_closure_document has no interactive RLS
  // read policy yet (only the unattended retention job's GUC can see it),
  // so AttendanceRetentionArchiveLookupService always resolves "not found"
  // and this endpoint falls back to the pre-existing silent-absent shape.
  // Safe, self-documented degradation, not a bug — see that service's own
  // header. Resolves itself automatically once Open Question 4 ("quem pode
  // ler/baixar o documento de fechamento", architecture-overview.md, Frente
  // 10) gets an interactive RLS policy; no code change needed here then.
  @Get('attendance')
  getMyAttendance(@Req() request: AuthenticatedRequest, @Query('classGroupId') classGroupId?: string) {
    return this.personAttendanceService.getMyAttendanceHistory(request.personId, classGroupId);
  }

  @Get('schedule')
  getMySchedule(@Req() request: AuthenticatedRequest) {
    return this.scheduleService.getMySchedule(request.personId);
  }

  @Get('context')
  getMyContext(@Req() request: AuthenticatedRequest) {
    return this.contextService.getContext(request.personId);
  }

  @Get('teaching-class-groups')
  getMyTeachingClassGroups(@Req() request: AuthenticatedRequest) {
    return this.teachingClassGroupsService.getTeachingClassGroups(request.personId);
  }

  @Get('coordinated-class-groups')
  getMyCoordinatedClassGroups(@Req() request: AuthenticatedRequest) {
    return this.coordinatedClassGroupsService.getCoordinatedClassGroups(request.personId);
  }

  // Leadership-chain-scoped presence read (RULE-ATT-12/RULE-INST-09), not a
  // "my own data" read — see MeClassGroupAttendanceService for the
  // authorization check this delegates to before touching any presence data.
  @Get('class-groups/:classGroupId/attendance')
  getClassGroupAttendance(
    @Param('classGroupId', ParseUUIDPipe) classGroupId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.classGroupAttendanceService.getAttendanceForAuthorizedClassGroup(request.personId, classGroupId);
  }

  // Frente 06, Controle B — the student's avisos area (RULE-FREQ-04 items 2
  // and 4). Squarely the FIRST idiom of this controller: "my own data", no
  // permission check, for the reason the header above already states — and
  // reinforced here by RULE-FREQ-04 addendum b, which makes the warning
  // EXCLUSIVE to the student (professor and coordenador have no access to it
  // at all). So: no @RequirePermission, and no LeadershipScopeService —
  // Controle B has no dependency on it and must not acquire one. No
  // admin/professor-facing variant of this route exists, deliberately.
  //
  // personId comes from request.personId only, never from a route/query/body
  // param — the security invariant stated in the header, which here also
  // means a student can never read another student's warnings.
  //
  // This GET writes (seen_at on first read, plus the lazy reconciliation the
  // service runs before reading). That is by design, not an accident of
  // implementation; the full reasoning is in FrequencyWarningReadService.
  @Get('warnings')
  getMyWarnings(@Req() request: AuthenticatedRequest) {
    return this.warningReadService.listActiveWarningsForPerson(request.personId);
  }

  // RULE-PRES-10/11 (Bloco 4 — Contagem por câmera como cruzamento).
  // Teacher-of-this-session read, computed live from
  // ClassroomHeadcountReconciliationService — the SAME computation the
  // periodic classroom-headcount-reconciliation job runs, exposed here for
  // the Portal Web to poll/display instead of a new notification channel
  // (see that module's own header). Authorization (is this person a teacher
  // of this session's turma) happens inside
  // MeClassSessionHeadcountAlertService, not here — same "controller stays
  // thin, delegates its own authorization check" idiom as
  // getClassGroupAttendance above.
  @Get('class-sessions/:classSessionId/headcount-alert')
  getClassSessionHeadcountAlert(
    @Param('classSessionId', ParseUUIDPipe) classSessionId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.headcountAlertService.getHeadcountAlertForAuthorizedSession(request.personId, classSessionId);
  }
}
