import { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { IsNotEmptyObject, IsObject, IsString } from 'class-validator';

// Same loose-validation posture as device-identity's
// WebauthnRegistrationVerifyDto — the WebAuthn signature verification inside
// DeviceCredentialService.verifyAuthentication is the real gate.
export class WebauthnLoginVerifyDto {
  @IsString()
  challengeToken: string;

  @IsObject()
  @IsNotEmptyObject()
  response: AuthenticationResponseJSON;
}
