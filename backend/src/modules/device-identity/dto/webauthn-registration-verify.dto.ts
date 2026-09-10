import { IsNotEmptyObject, IsObject, IsString } from 'class-validator';
import { RegistrationResponseJSON } from '@simplewebauthn/server';

// `response` is the opaque JSON @simplewebauthn/browser's startRegistration()
// produces — deep class-validator schemas for the full WebAuthn response
// shape aren't standard practice here (same posture as
// IngestionEventEnvelopeDto.data); the cryptographic verification inside
// DeviceCredentialService.verifyRegistration is the real gate on malformed
// input, not this DTO.
export class WebauthnRegistrationVerifyDto {
  @IsString()
  challengeToken: string;

  @IsObject()
  @IsNotEmptyObject()
  response: RegistrationResponseJSON;
}
