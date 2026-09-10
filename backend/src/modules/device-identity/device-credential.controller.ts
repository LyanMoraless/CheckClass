import { Body, Controller, Param, ParseUUIDPipe, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import { TenantContextInterceptor } from '../../database/tenant-context.interceptor';
import { AuthenticatedRequest, JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceCredentialService } from './device-credential.service';
import { WebauthnRegistrationVerifyDto } from './dto/webauthn-registration-verify.dto';

// Matrícula de credencial WebAuthn (RULE-DEV-01, step 2 — decoupled from
// cadastro). Shared endpoint pair for institutional_machine AND
// personal_device: DeviceCredentialService.assertCanManageCredential resolves
// which one deviceIdentityId is and authorizes accordingly, so there is no
// forked controller per subtype ("mesma capacidade compartilhada, sem
// bifurcar código"). No @RequirePermission — same reasoning as
// InstitutionalMachineController.
@Controller('v1/device-identity/credentials')
@UseGuards(JwtAuthGuard)
@UseInterceptors(TenantContextInterceptor)
export class DeviceCredentialController {
  constructor(private readonly credentialService: DeviceCredentialService) {}

  @Post(':deviceIdentityId/registration-options')
  generateRegistrationOptions(@Param('deviceIdentityId', ParseUUIDPipe) deviceIdentityId: string, @Req() request: AuthenticatedRequest) {
    return this.credentialService.generateRegistrationOptionsFor(deviceIdentityId, request.personId);
  }

  @Post(':deviceIdentityId/registration-verify')
  verifyRegistration(
    @Param('deviceIdentityId', ParseUUIDPipe) deviceIdentityId: string,
    @Body() body: WebauthnRegistrationVerifyDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.credentialService.verifyRegistration(deviceIdentityId, request.personId, body.challengeToken, body.response);
  }
}
