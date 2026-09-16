import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { GuardianLinkFollowupService } from '../guardian-link-followup/guardian-link-followup.service';
import { ConfirmDateOfBirthDto } from './dto/confirm-date-of-birth.dto';
import { CreatePersonDto } from './dto/create-person.dto';
import { ResolveGuardianLinkFollowupDto } from './dto/resolve-guardian-link-followup.dto';
import { PersonManagementService } from './person-management.service';

@Controller('v1/users')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class PersonManagementController {
  constructor(
    private readonly personManagementService: PersonManagementService,
    // This endpoint is about the followup, not about the person itself —
    // injected directly rather than proxied through PersonManagementService.
    private readonly guardianLinkFollowupService: GuardianLinkFollowupService,
  ) {}

  @Post()
  create(@Body() body: CreatePersonDto) {
    return this.personManagementService.createPerson(body);
  }

  // Added for the admin frontend: other screens (enrollment, wristband
  // issue, permission-group membership) need to look up a personId by name.
  // Method-level override (does NOT widen the class-level MANAGE_USERS
  // gate, which still covers create()): ClassGroupController.enroll() is
  // gated MANAGE_INSTITUTION_STRUCTURE and needs a personId to enroll
  // someone, so that permission alone must also be enough to list here.
  @Get()
  @RequirePermission(Permission.MANAGE_USERS, Permission.MANAGE_INSTITUTION_STRUCTURE)
  list() {
    return this.personManagementService.list();
  }

  // RULE-GRD-05 read-control allowlist: no method-level @RequirePermission
  // override here (unlike list() above) — this stays under the class-level
  // MANAGE_USERS gate only, since the raw date_of_birth value is
  // Secretaria-exclusive. Used to pre-fill the Secretaria's own confirmation
  // form.
  @Get(':personId/date-of-birth')
  getDateOfBirth(@Param('personId', ParseUUIDPipe) personId: string) {
    return this.personManagementService.getDateOfBirthDetail(personId);
  }

  // RULE-GRD-07: presencial confirmation, Secretaria-only (same allowlist
  // reasoning as getDateOfBirth above). confirmedByPersonId always comes
  // from the verified JWT, never from the request body — same idiom as
  // every other "who did this" audit field in this codebase (e.g.
  // DeviceBindingController.upsertConfig).
  @Patch(':personId/date-of-birth')
  confirmDateOfBirth(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() body: ConfirmDateOfBirthDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.personManagementService.confirmDateOfBirth(personId, body.dateOfBirth, request.personId);
  }

  // guardian_link_followup closure (architecture-overview.md's "Fechamento"
  // section) — same allowlist reasoning as getDateOfBirth/confirmDateOfBirth
  // above (no method-level @RequirePermission override). resolvedByPersonId
  // always comes from the verified JWT, never the body, same idiom as
  // confirmDateOfBirth.
  //
  // Integrity check: this route nests followupId under :personId, but
  // nothing besides the class-level permission would otherwise stop closing
  // another person's followup through it — reject with the SAME 404 used for
  // "no such followup at all", so this route never discloses whether a given
  // followupId exists for a different person.
  @Patch(':personId/guardian-link-followups/:followupId')
  async resolveGuardianLinkFollowup(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('followupId', ParseUUIDPipe) followupId: string,
    @Body() body: ResolveGuardianLinkFollowupDto,
    @Req() request: AuthenticatedRequest,
  ) {
    const followup = await this.guardianLinkFollowupService.findById(followupId);
    if (!followup || followup.subjectPersonId !== personId) {
      throw new NotFoundException(`guardian link followup ${followupId} not found for person ${personId}`);
    }
    return this.guardianLinkFollowupService.resolve(followupId, request.personId, body.resolutionNote);
  }
}
