import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CreateLegalGuardianDto } from './dto/create-legal-guardian.dto';
import { UpdateLegalGuardianDto } from './dto/update-legal-guardian.dto';
import { LegalGuardianService } from './legal-guardian.service';

// "Decisão de arquitetura — CRUD de legal_guardian" (architecture-overview.md,
// approved 2026-09-15). Nested under the student's person, same idiom as
// GET/PATCH /v1/users/:personId/date-of-birth — no top-level report endpoint
// (unlike guardian_link_followup, which needs one as a "rede de segurança"
// safety net; there's no documented equivalent need here). Same Secretaria
// -exclusive allowlist (class-level MANAGE_USERS, no method-level widening).
@Controller('v1/users/:personId/legal-guardians')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class LegalGuardianController {
  constructor(private readonly legalGuardianService: LegalGuardianService) {}

  // registeredByPersonId always comes from the verified JWT, never the body
  // — same idiom as every other "who did this" audit field in this codebase.
  @Post()
  create(@Param('personId', ParseUUIDPipe) personId: string, @Body() body: CreateLegalGuardianDto, @Req() request: AuthenticatedRequest) {
    return this.legalGuardianService.create({
      studentPersonId: personId,
      fullName: body.fullName,
      documentNumber: body.documentNumber,
      registeredByPersonId: request.personId,
    });
  }

  // Only status='active' by default; ?status=all also returns revoked links.
  @Get()
  listByStudent(@Param('personId', ParseUUIDPipe) personId: string, @Query('status') status?: string) {
    return this.legalGuardianService.listByStudent(personId, status === 'all');
  }

  @Patch(':guardianId')
  async update(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Body() body: UpdateLegalGuardianDto,
  ) {
    await this.assertBelongsToStudent(personId, guardianId);
    return this.legalGuardianService.update(guardianId, body);
  }

  // Soft revoke only (status='revoked') — legal_guardian is never physically
  // deleted (RULE-GRD-06, FixLegalGuardianGrants migration revokes the DB
  // DELETE grant). Same POST .../:id/revoke idiom already used by
  // DeviceController/WristbandController, not a DELETE verb, since this also
  // triggers two independent side effects (see LegalGuardianService.revoke),
  // not just a state flip. revokedByPersonId always comes from the verified
  // JWT, never the body.
  @Post(':guardianId/revoke')
  async revoke(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    await this.assertBelongsToStudent(personId, guardianId);
    return this.legalGuardianService.revoke(guardianId, request.personId);
  }

  // Integrity check: these routes nest guardianId under :personId, but
  // nothing besides the class-level permission would otherwise stop
  // updating/revoking another student's guardian through it — reject with
  // the SAME 404 used for "no such guardian at all", same idiom as
  // PersonManagementController.resolveGuardianLinkFollowup.
  private async assertBelongsToStudent(personId: string, guardianId: string): Promise<void> {
    const guardian = await this.legalGuardianService.findById(guardianId);
    if (!guardian || guardian.studentPersonId !== personId) {
      throw new NotFoundException(`legal guardian ${guardianId} not found for person ${personId}`);
    }
  }
}
