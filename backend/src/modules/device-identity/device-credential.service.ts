import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { QueryFailedError } from 'typeorm';
import { DeviceCredentialEntity, DeviceIdentityEntity, InstitutionalMachineEntity, PersonalDeviceEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

const UNIQUE_VIOLATION = '23505';
// Tech Decision B: the challenge only needs to survive the round trip
// between "generate options" and "verify" (a single WebAuthn ceremony,
// normally sub-second to a few seconds of user interaction) — 2 minutes is
// generous slack, not a session lifetime.
const CHALLENGE_TOKEN_TTL = '2m';

type RegistrationChallengePurpose = 'device_credential_registration';
type AuthenticationChallengePurpose = 'device_credential_authentication';

interface RegistrationChallengePayload {
  purpose: RegistrationChallengePurpose;
  deviceIdentityId: string;
  challenge: string;
}

interface AuthenticationChallengePayload {
  purpose: AuthenticationChallengePurpose;
  challenge: string;
}

export interface RegistrationCeremonyOptions {
  options: Awaited<ReturnType<typeof generateRegistrationOptions>>;
  challengeToken: string;
}

export interface AuthenticationCeremonyOptions {
  options: Awaited<ReturnType<typeof generateAuthenticationOptions>>;
  challengeToken: string;
}

// Tech Decision A: @simplewebauthn/server, one shared capability for
// institutional_machine AND personal_device (RULE-DEV-01/02 — "mesma
// capacidade compartilhada, sem bifurcar código"). RP ID is platform-wide
// (WEBAUTHN_RP_ID), not per tenant — see architecture-overview.md's
// justification. The challenge travels client-side inside a short-lived JWT
// (this module's own JwtService, reused from AuthModule) rather than any
// server-side session store, per Tech Decision A's explicit "no Redis, no
// cache-manager" note.
//
// Authentication (login) ceremony deliberately does NOT take a
// deviceIdentityId parameter at all: RULE-DEV-01 nota C4 forbids trusting a
// client-declared machine id. The server only ever learns which
// device_identity a login belongs to AFTER verifying the signed assertion,
// by looking up device_credential.credential_id = response.id — the exact
// "get the credential from your database using response.id" step
// @simplewebauthn's own docs describe, not a client-supplied identifier
// being trusted.
@Injectable()
export class DeviceCredentialService {
  private readonly rpId: string;
  private readonly rpName: string;
  private readonly allowedOrigins: string[];

  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly jwtService: JwtService,
    config: ConfigService,
  ) {
    this.rpId = config.get<string>('WEBAUTHN_RP_ID') as string;
    this.rpName = config.get<string>('WEBAUTHN_RP_NAME') as string;
    this.allowedOrigins = (config.get<string>('CORS_ORIGIN') as string).split(',');
  }

  // ---- Registration (matrícula, step 2 — decoupled from cadastro/step 1) ----

  async generateRegistrationOptionsFor(deviceIdentityId: string, requesterPersonId: string): Promise<RegistrationCeremonyOptions> {
    await this.assertCanManageCredential(deviceIdentityId, requesterPersonId);

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userName: deviceIdentityId,
      // Deterministic per device_identity — re-registering the same machine
      // (RULE-DEV-01's reimage exception) reuses the same WebAuthn user
      // handle instead of a fresh random one on every matrícula.
      userID: this.deviceIdentityIdToUserId(deviceIdentityId),
      attestationType: 'none',
      authenticatorSelection: {
        // RULE-DEV-01: pushes the browser toward the TPM-backed platform
        // authenticator (Windows Hello/similar), not a portable USB security
        // key. This is a hint, not proof — genuine TPM-backing is a device
        // property the server cannot verify beyond this; Tech Decision C's
        // frontend capability check is the closest enforceable signal.
        authenticatorAttachment: 'platform',
        residentKey: 'preferred',
        userVerification: 'required',
      },
    });

    const challengeToken = this.signChallengeToken<RegistrationChallengePayload>({
      purpose: 'device_credential_registration',
      deviceIdentityId,
      challenge: options.challenge,
    });
    return { options, challengeToken };
  }

  async verifyRegistration(
    deviceIdentityId: string,
    requesterPersonId: string,
    challengeToken: string,
    response: RegistrationResponseJSON,
  ): Promise<DeviceCredentialEntity> {
    await this.assertCanManageCredential(deviceIdentityId, requesterPersonId);

    const payload = this.verifyChallengeToken<RegistrationChallengePayload>(challengeToken, 'device_credential_registration');
    if (payload.deviceIdentityId !== deviceIdentityId) {
      throw new UnauthorizedException('registration challenge does not match the target device');
    }

    const verification = await this.tryVerify(() =>
      verifyRegistrationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: this.allowedOrigins,
        expectedRPID: this.rpId,
      }),
    );
    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('WebAuthn registration could not be verified');
    }

    const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(DeviceCredentialEntity);

    // RULE-DEV-01 exception (reimage/re-matrícula): revoke whichever
    // credential was previously active for this identity, if any, before
    // inserting the fresh one — device_credential_one_active_per_identity_
    // unique (AddDeviceBinding migration) would otherwise reject the insert.
    await repository.update({ deviceIdentityId, status: 'active' }, { status: 'revoked', revokedAt: new Date() });

    try {
      return await repository.save(
        repository.create({
          tenantId,
          deviceIdentityId,
          credentialId: credential.id,
          publicKey: Buffer.from(credential.publicKey),
          counter: String(credential.counter),
          transports: response.response.transports ?? null,
          backedUp: credentialBackedUp,
          deviceType: credentialDeviceType,
          status: 'active',
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION) {
        throw new ConflictException(
          `device_identity ${deviceIdentityId} already has an active credential — a concurrent registration may have raced this one`,
        );
      }
      throw error;
    }
  }

  // ---- Authentication (login ceremony, consumed by device-binding) ----

  async generateAuthenticationCeremonyOptions(): Promise<AuthenticationCeremonyOptions> {
    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      // No allowCredentials on purpose — a discoverable-credential flow lets
      // the platform authenticator surface whichever credential(s) it holds
      // for this rpID, rather than the server needing to already know which
      // deviceIdentityId this browser belongs to (it doesn't, and RULE-DEV-01
      // nota C4 forbids the client declaring one).
      userVerification: 'required',
    });
    const challengeToken = this.signChallengeToken<AuthenticationChallengePayload>({
      purpose: 'device_credential_authentication',
      challenge: options.challenge,
    });
    return { options, challengeToken };
  }

  async verifyAuthentication(challengeToken: string, response: AuthenticationResponseJSON): Promise<{ deviceIdentityId: string }> {
    const payload = this.verifyChallengeToken<AuthenticationChallengePayload>(challengeToken, 'device_credential_authentication');

    const manager = this.tenantContext.getManager();
    const credentialRepository = manager.getRepository(DeviceCredentialEntity);
    // Tenant isolation here comes from the request's already-established RLS
    // scope (TenantContextInterceptor), same as every other tenant-scoped
    // read in this codebase — credential_id is only UNIQUE per tenant, not
    // globally, but RLS means this lookup can never see another tenant's row
    // even in the cryptographically negligible case of an id collision.
    const credentialRow = await credentialRepository.findOneBy({ credentialId: response.id, status: 'active' });
    if (!credentialRow) {
      throw new UnauthorizedException('Unknown or revoked device credential');
    }

    const verification = await this.tryVerify(() =>
      verifyAuthenticationResponse({
        response,
        expectedChallenge: payload.challenge,
        expectedOrigin: this.allowedOrigins,
        expectedRPID: this.rpId,
        credential: {
          id: credentialRow.credentialId,
          // Buffer's ArrayBufferLike typing (possibly SharedArrayBuffer)
          // doesn't structurally match Uint8Array_'s ArrayBuffer-backed
          // generic under TS 5.7 — Uint8Array.from() copies into a fresh,
          // plain-ArrayBuffer-backed Uint8Array.
          publicKey: Uint8Array.from(credentialRow.publicKey),
          counter: Number(credentialRow.counter),
          transports: credentialRow.transports ?? undefined,
        },
      }),
    );
    if (!verification.verified) {
      throw new UnauthorizedException('WebAuthn assertion could not be verified');
    }

    // Anti-replay counter (RULE-DEV-01) — persisted so the next login's
    // verifyAuthenticationResponse can keep enforcing it strictly increases.
    await credentialRepository.update({ id: credentialRow.id }, { counter: String(verification.authenticationInfo.newCounter) });

    return { deviceIdentityId: credentialRow.deviceIdentityId };
  }

  // ---- Shared authorization: who may register/re-register a credential ----

  // RULE-DEV-01/02: matrícula is the same capability for both subtypes, only
  // WHO is authorized differs — institutional_machine follows RULE-DEV-15
  // (Direção/Reitoria, same LeadershipScopeService mechanism as
  // InstitutionalMachineService), personal_device is self-service only (its
  // owner; RULE-DEV-18's admin-revoke titular is deliberately NOT extended
  // here — nothing in RULE-DEV-02/17/18 says an administrator registers a
  // credential on someone else's behalf).
  private async assertCanManageCredential(deviceIdentityId: string, requesterPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();

    const machine = await manager.getRepository(InstitutionalMachineEntity).findOneBy({ id: deviceIdentityId });
    if (machine) {
      const scope = await this.leadershipScope.getCourseScope(requesterPersonId);
      if (!scope.allCourses) {
        throw new ForbiddenException(
          `Person ${requesterPersonId} has no Direção/Reitoria authority to manage credentials for institutional_machine ${deviceIdentityId} (RULE-DEV-15)`,
        );
      }
      return;
    }

    const personalDevice = await manager.getRepository(PersonalDeviceEntity).findOneBy({ id: deviceIdentityId });
    if (personalDevice) {
      if (personalDevice.personId !== requesterPersonId) {
        throw new ForbiddenException(`Person ${requesterPersonId} does not own personal_device ${deviceIdentityId} (RULE-DEV-02)`);
      }
      return;
    }

    const identityExists = await manager.getRepository(DeviceIdentityEntity).findOneBy({ id: deviceIdentityId });
    if (!identityExists) {
      throw new NotFoundException(`device_identity ${deviceIdentityId} not found`);
    }
    // A device_identity row exists but neither subtype does — the invariant
    // InstitutionalMachineService/PersonalDeviceService are supposed to
    // uphold (device-identity.entity.ts's header comment) is broken; this
    // should never happen in practice.
    throw new NotFoundException(`device_identity ${deviceIdentityId} has no institutional_machine or personal_device row`);
  }

  private signChallengeToken<T extends object>(payload: T): string {
    return this.jwtService.sign({ ...payload }, { expiresIn: CHALLENGE_TOKEN_TTL });
  }

  private verifyChallengeToken<T extends { purpose: string }>(token: string, expectedPurpose: T['purpose']): T {
    let payload: T;
    try {
      payload = this.jwtService.verify<T>(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired WebAuthn challenge token');
    }
    if (payload.purpose !== expectedPurpose) {
      throw new UnauthorizedException('WebAuthn challenge token was issued for a different purpose');
    }
    return payload;
  }

  // @simplewebauthn throws plain Errors on malformed/unparseable responses
  // (e.g. a tampered or hand-crafted body) rather than returning
  // verified:false — normalized here to a 400 that never leaks the library's
  // internal error message (backend-development skill: never leak internal
  // details), distinct from the 401s above for a well-formed-but-cryptographically-
  // invalid response.
  private async tryVerify<T>(run: () => Promise<T>): Promise<T> {
    try {
      return await run();
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new BadRequestException('Malformed WebAuthn response');
    }
  }

  // Return type deliberately NOT annotated as the bare `Uint8Array` alias —
  // under TS 5.7's ArrayBufferLike-generic typed arrays, that alias defaults
  // to `Uint8Array<ArrayBufferLike>` (wider than what Uint8Array.from()
  // actually returns), which then fails to satisfy generateRegistrationOptions'
  // narrower `Uint8Array<ArrayBuffer>` expectation. Letting TS infer the
  // return type keeps it precisely `Uint8Array<ArrayBuffer>`.
  private deviceIdentityIdToUserId(deviceIdentityId: string) {
    return Uint8Array.from(Buffer.from(deviceIdentityId.replace(/-/g, ''), 'hex'));
  }
}
