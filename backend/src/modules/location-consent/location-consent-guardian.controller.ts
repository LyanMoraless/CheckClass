import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionCheckInterceptor } from '../auth/permission-check.interceptor';
import { Permission } from '../auth/permission.enum';
import { RequirePermission } from '../auth/require-permission.decorator';
import { LegalGuardianService } from '../legal-guardian/legal-guardian.service';
import { RecordLocationConsentDecisionDto } from './dto/record-location-consent-decision.dto';
import { LocationConsentService } from './location-consent.service';

// RULE-PRES-14 — responsável legal deciding on behalf of a student, via
// atendimento presencial pela Secretaria. Same nesting/allowlist idiom as
// LegalGuardianController (v1/users/:personId/legal-guardians, class-level
// MANAGE_USERS, no method-level widening) plus the guardianId->studentId
// integrity check that controller already uses (assertActiveGuardianOfStudent
// below), extended here to also require status='active': a revoked
// legal_guardian link is no longer an authority to decide anything for this
// student.
@Controller('v1/users/:personId/legal-guardians/:guardianId/location-consent')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor, PermissionCheckInterceptor)
@RequirePermission(Permission.MANAGE_USERS)
export class LocationConsentGuardianController {
  constructor(
    private readonly locationConsentService: LocationConsentService,
    private readonly legalGuardianService: LegalGuardianService,
  ) {}

  @Get()
  async getConsent(@Param('personId', ParseUUIDPipe) personId: string, @Param('guardianId', ParseUUIDPipe) guardianId: string) {
    await this.assertActiveGuardianOfStudent(personId, guardianId);
    return this.locationConsentService.getActiveConsent(personId);
  }

  @Post('grant')
  async grant(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Body() body: RecordLocationConsentDecisionDto,
  ) {
    await this.assertActiveGuardianOfStudent(personId, guardianId);
    return this.locationConsentService.grantByGuardian(personId, guardianId, body.consentVersion);
  }

  @Post('refuse')
  async refuse(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('guardianId', ParseUUIDPipe) guardianId: string,
    @Body() body: RecordLocationConsentDecisionDto,
  ) {
    await this.assertActiveGuardianOfStudent(personId, guardianId);
    return this.locationConsentService.refuseByGuardian(personId, guardianId, body.consentVersion);
  }

  @Post('revoke')
  async revoke(@Param('personId', ParseUUIDPipe) personId: string, @Param('guardianId', ParseUUIDPipe) guardianId: string) {
    await this.assertActiveGuardianOfStudent(personId, guardianId);
    return this.locationConsentService.revokeByGuardian(personId, guardianId);
  }

  // Same 404-folds-two-cases idiom as LegalGuardianController.assertBelongsToStudent
  // ("does not exist" and "exists for a different student" never disclosed
  // apart) — widened here to also fold in "exists for this student but is
  // revoked", since a revoked guardian must not be usable to decide anything
  // new for this student either.
  private async assertActiveGuardianOfStudent(personId: string, guardianId: string): Promise<void> {
    const guardian = await this.legalGuardianService.findById(guardianId);
    if (!guardian || guardian.studentPersonId !== personId || guardian.status !== 'active') {
      throw new NotFoundException(`legal guardian ${guardianId} not found for person ${personId}`);
    }
  }
}
