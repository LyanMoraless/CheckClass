import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import { QueryFailedError } from 'typeorm';
import { DeviceCredentialEntity, DeviceIdentityEntity, InstitutionalMachineEntity, PersonalDeviceEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { DeviceCredentialService } from './device-credential.service';

// @simplewebauthn/server does the actual cryptographic verification — mocked
// at its public seam (same posture the project already applies to other
// external-library boundaries), so these tests exercise DeviceCredentialService's
// OWN logic: RULE-DEV-01's shared-but-differently-authorized matrícula
// (institutional_machine via Direção/Reitoria, personal_device via
// ownership), RULE-DEV-01's reimage/re-matrícula credential revocation, the
// unique-violation race safety net, and the anti-spoofing posture of
// verifyAuthentication (RULE-DEV-01 nota C4 — deviceIdentityId is only ever
// learned AFTER a verified assertion, never accepted from the caller).
jest.mock('@simplewebauthn/server', () => ({
  generateRegistrationOptions: jest.fn(),
  generateAuthenticationOptions: jest.fn(),
  verifyRegistrationResponse: jest.fn(),
  verifyAuthenticationResponse: jest.fn(),
}));

const mockGenerateRegistrationOptions = generateRegistrationOptions as jest.Mock;
const mockGenerateAuthenticationOptions = generateAuthenticationOptions as jest.Mock;
const mockVerifyRegistrationResponse = verifyRegistrationResponse as jest.Mock;
const mockVerifyAuthenticationResponse = verifyAuthenticationResponse as jest.Mock;

const DEVICE_IDENTITY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const REGISTRATION_PURPOSE = 'device_credential_registration';
const AUTHENTICATION_PURPOSE = 'device_credential_authentication';

describe('DeviceCredentialService', () => {
  function buildService(
    options: {
      identityKind?: 'institutional' | 'personal' | 'orphan' | 'missing';
      leadershipAuthorized?: boolean;
      personalDeviceOwnerId?: string;
      credentialLookup?: Partial<DeviceCredentialEntity> | null;
    } = {},
  ) {
    const identityKind = options.identityKind ?? 'personal';
    const personalDeviceOwnerId = options.personalDeviceOwnerId ?? 'person-1';

    const machineRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(identityKind === 'institutional' ? { id: DEVICE_IDENTITY_ID } : null),
    });
    const personalDeviceRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(identityKind === 'personal' ? { id: DEVICE_IDENTITY_ID, personId: personalDeviceOwnerId } : null),
    });
    const identityRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(identityKind === 'orphan' ? { id: DEVICE_IDENTITY_ID } : null),
    });
    const credentialRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.credentialLookup ?? null),
      save: jest.fn((entity: unknown) => Promise.resolve({ id: 'credential-1', ...(entity as object) })),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [InstitutionalMachineEntity, machineRepo],
      [PersonalDeviceEntity, personalDeviceRepo],
      [DeviceIdentityEntity, identityRepo],
      [DeviceCredentialEntity, credentialRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);

    const leadershipScope = {
      getCourseScope: jest.fn().mockResolvedValue({ allCourses: options.leadershipAuthorized ?? true, courseIds: [] }),
    } as unknown as LeadershipScopeService;

    const jwtService = {
      sign: jest.fn().mockReturnValue('signed-challenge-token'),
      verify: jest.fn(),
    };

    const configValues: Record<string, string> = {
      WEBAUTHN_RP_ID: 'checkclass.example',
      WEBAUTHN_RP_NAME: 'CheckClass',
      CORS_ORIGIN: 'https://app.checkclass.example',
    };
    const configService = { get: jest.fn((key: string) => configValues[key]) } as unknown as ConfigService;

    const service = new DeviceCredentialService(tenantContext as never, leadershipScope, jwtService as never, configService);
    return { service, machineRepo, personalDeviceRepo, identityRepo, credentialRepo, leadershipScope, jwtService };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateRegistrationOptionsFor / assertCanManageCredential (RULE-DEV-01/02/15)', () => {
    test('test_generateRegistrationOptionsFor_institutionalMachineAuthorizedDirection_returnsOptionsAndSignedChallenge', async () => {
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'server-challenge' });
      const { service, jwtService } = buildService({ identityKind: 'institutional', leadershipAuthorized: true });

      const result = await service.generateRegistrationOptionsFor(DEVICE_IDENTITY_ID, 'direction-1');

      expect(mockGenerateRegistrationOptions).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: REGISTRATION_PURPOSE, deviceIdentityId: DEVICE_IDENTITY_ID, challenge: 'server-challenge' }),
        { expiresIn: '2m' },
      );
      expect(result).toEqual({ options: { challenge: 'server-challenge' }, challengeToken: 'signed-challenge-token' });
    });

    test('test_generateRegistrationOptionsFor_institutionalMachineNotDirection_throwsForbiddenWithoutGeneratingOptions', async () => {
      const { service } = buildService({ identityKind: 'institutional', leadershipAuthorized: false });

      await expect(service.generateRegistrationOptionsFor(DEVICE_IDENTITY_ID, 'professor-1')).rejects.toThrow(ForbiddenException);
      expect(mockGenerateRegistrationOptions).not.toHaveBeenCalled();
    });

    test('test_generateRegistrationOptionsFor_personalDeviceOwner_succeeds', async () => {
      mockGenerateRegistrationOptions.mockResolvedValue({ challenge: 'server-challenge' });
      const { service } = buildService({ identityKind: 'personal', personalDeviceOwnerId: 'person-1' });

      await expect(service.generateRegistrationOptionsFor(DEVICE_IDENTITY_ID, 'person-1')).resolves.toBeDefined();
    });

    test('test_generateRegistrationOptionsFor_personalDeviceNotOwner_throwsForbiddenWithoutGeneratingOptions', async () => {
      const { service } = buildService({ identityKind: 'personal', personalDeviceOwnerId: 'owner-1' });

      await expect(service.generateRegistrationOptionsFor(DEVICE_IDENTITY_ID, 'someone-else')).rejects.toThrow(ForbiddenException);
      expect(mockGenerateRegistrationOptions).not.toHaveBeenCalled();
    });

    test('test_generateRegistrationOptionsFor_deviceIdentityIsOrphanWithNoSubtypeRow_throwsNotFound', async () => {
      const { service } = buildService({ identityKind: 'orphan' });

      await expect(service.generateRegistrationOptionsFor(DEVICE_IDENTITY_ID, 'person-1')).rejects.toThrow(NotFoundException);
    });

    test('test_generateRegistrationOptionsFor_deviceIdentityDoesNotExistAtAll_throwsNotFound', async () => {
      const { service } = buildService({ identityKind: 'missing' });

      await expect(service.generateRegistrationOptionsFor(DEVICE_IDENTITY_ID, 'person-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyRegistration (RULE-DEV-01)', () => {
    function mockVerifiedRegistration() {
      mockVerifyRegistrationResponse.mockResolvedValue({
        verified: true,
        registrationInfo: {
          credential: { id: 'new-credential-id', publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
          credentialDeviceType: 'singleDevice',
          credentialBackedUp: false,
        },
      });
    }

    test('test_verifyRegistration_challengeDeviceIdentityMismatch_throwsUnauthorizedWithoutVerifying', async () => {
      const { service, jwtService } = buildService({ identityKind: 'personal' });
      jwtService.verify.mockReturnValue({ purpose: REGISTRATION_PURPOSE, deviceIdentityId: 'a-different-device-id', challenge: 'x' });

      await expect(
        service.verifyRegistration(DEVICE_IDENTITY_ID, 'person-1', 'token', {} as never),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockVerifyRegistrationResponse).not.toHaveBeenCalled();
    });

    test('test_verifyRegistration_challengeTokenInvalidOrExpired_throwsUnauthorized', async () => {
      const { service, jwtService } = buildService({ identityKind: 'personal' });
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.verifyRegistration(DEVICE_IDENTITY_ID, 'person-1', 'expired-token', {} as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    test('test_verifyRegistration_challengeTokenWrongPurpose_throwsUnauthorized', async () => {
      const { service, jwtService } = buildService({ identityKind: 'personal' });
      // A valid, unexpired token — but issued for authentication, not registration.
      jwtService.verify.mockReturnValue({ purpose: AUTHENTICATION_PURPOSE, challenge: 'x' });

      await expect(service.verifyRegistration(DEVICE_IDENTITY_ID, 'person-1', 'token', {} as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    test('test_verifyRegistration_verificationFails_throwsUnauthorized', async () => {
      const { service, jwtService } = buildService({ identityKind: 'personal' });
      jwtService.verify.mockReturnValue({ purpose: REGISTRATION_PURPOSE, deviceIdentityId: DEVICE_IDENTITY_ID, challenge: 'server-challenge' });
      mockVerifyRegistrationResponse.mockResolvedValue({ verified: false });

      await expect(service.verifyRegistration(DEVICE_IDENTITY_ID, 'person-1', 'token', {} as never)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    test('test_verifyRegistration_libraryThrowsOnMalformedResponse_wrapsAsBadRequestNotUnauthorized', async () => {
      const { service, jwtService } = buildService({ identityKind: 'personal' });
      jwtService.verify.mockReturnValue({ purpose: REGISTRATION_PURPOSE, deviceIdentityId: DEVICE_IDENTITY_ID, challenge: 'server-challenge' });
      mockVerifyRegistrationResponse.mockRejectedValue(new TypeError('Cannot read properties of undefined'));

      await expect(service.verifyRegistration(DEVICE_IDENTITY_ID, 'person-1', 'token', {} as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    test('test_verifyRegistration_success_revokesPriorActiveCredentialThenSavesNewOne', async () => {
      const { service, jwtService, credentialRepo } = buildService({ identityKind: 'personal' });
      jwtService.verify.mockReturnValue({ purpose: REGISTRATION_PURPOSE, deviceIdentityId: DEVICE_IDENTITY_ID, challenge: 'server-challenge' });
      mockVerifiedRegistration();

      await service.verifyRegistration(DEVICE_IDENTITY_ID, 'person-1', 'token', {
        response: { transports: ['internal'] },
      } as never);

      expect(credentialRepo.update).toHaveBeenCalledWith(
        { deviceIdentityId: DEVICE_IDENTITY_ID, status: 'active' },
        expect.objectContaining({ status: 'revoked' }),
      );
      expect(credentialRepo.save).toHaveBeenCalledWith(expect.objectContaining({ deviceIdentityId: DEVICE_IDENTITY_ID, status: 'active' }));
    });

    test('test_verifyRegistration_concurrentRegistrationRacesUniqueIndex_throwsConflict', async () => {
      const { service, jwtService, credentialRepo } = buildService({ identityKind: 'personal' });
      jwtService.verify.mockReturnValue({ purpose: REGISTRATION_PURPOSE, deviceIdentityId: DEVICE_IDENTITY_ID, challenge: 'server-challenge' });
      mockVerifiedRegistration();
      const uniqueViolation = Object.assign(new QueryFailedError('insert', [], new Error('duplicate key')), {
        driverError: { code: '23505' },
      });
      credentialRepo.save.mockRejectedValue(uniqueViolation);

      await expect(
        service.verifyRegistration(DEVICE_IDENTITY_ID, 'person-1', 'token', { response: {} } as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('generateAuthenticationCeremonyOptions', () => {
    test('test_generateAuthenticationCeremonyOptions_neverDeclaresAllowCredentials', async () => {
      mockGenerateAuthenticationOptions.mockResolvedValue({ challenge: 'auth-challenge' });
      const { service, jwtService } = buildService();

      const result = await service.generateAuthenticationCeremonyOptions();

      // RULE-DEV-01 nota C4: the server cannot know which deviceIdentityId a
      // browser belongs to before verification — allowCredentials must never
      // be passed, which would require exactly that foreknowledge.
      const callArgs = mockGenerateAuthenticationOptions.mock.calls[0][0];
      expect(callArgs).not.toHaveProperty('allowCredentials');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ purpose: AUTHENTICATION_PURPOSE, challenge: 'auth-challenge' }),
        { expiresIn: '2m' },
      );
      expect(result.challengeToken).toBe('signed-challenge-token');
    });
  });

  describe('verifyAuthentication (RULE-DEV-01 nota C4 — anti-spoofing)', () => {
    test('test_verifyAuthentication_unknownOrRevokedCredential_throwsUnauthorizedWithoutCallingLibrary', async () => {
      const { service, jwtService } = buildService({ credentialLookup: null });
      jwtService.verify.mockReturnValue({ purpose: AUTHENTICATION_PURPOSE, challenge: 'auth-challenge' });

      await expect(service.verifyAuthentication('token', { id: 'unknown-credential-id' } as never)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(mockVerifyAuthenticationResponse).not.toHaveBeenCalled();
    });

    test('test_verifyAuthentication_verificationFails_throwsUnauthorizedWithoutUpdatingCounter', async () => {
      const { service, jwtService, credentialRepo } = buildService({
        credentialLookup: { id: 'credential-1', deviceIdentityId: DEVICE_IDENTITY_ID, credentialId: 'cred-id', publicKey: Buffer.from([1]), counter: '0' },
      });
      jwtService.verify.mockReturnValue({ purpose: AUTHENTICATION_PURPOSE, challenge: 'auth-challenge' });
      mockVerifyAuthenticationResponse.mockResolvedValue({ verified: false });

      await expect(service.verifyAuthentication('token', { id: 'cred-id' } as never)).rejects.toThrow(UnauthorizedException);
      expect(credentialRepo.update).not.toHaveBeenCalled();
    });

    test('test_verifyAuthentication_libraryThrowsOnMalformedResponse_wrapsAsBadRequest', async () => {
      const { service, jwtService } = buildService({
        credentialLookup: { id: 'credential-1', deviceIdentityId: DEVICE_IDENTITY_ID, credentialId: 'cred-id', publicKey: Buffer.from([1]), counter: '0' },
      });
      jwtService.verify.mockReturnValue({ purpose: AUTHENTICATION_PURPOSE, challenge: 'auth-challenge' });
      mockVerifyAuthenticationResponse.mockRejectedValue(new TypeError('malformed'));

      await expect(service.verifyAuthentication('token', { id: 'cred-id' } as never)).rejects.toThrow(BadRequestException);
    });

    test('test_verifyAuthentication_success_persistsNewCounterAndReturnsDeviceIdentityIdNeverTrustingClientInput', async () => {
      const { service, jwtService, credentialRepo } = buildService({
        credentialLookup: { id: 'credential-1', deviceIdentityId: DEVICE_IDENTITY_ID, credentialId: 'cred-id', publicKey: Buffer.from([1]), counter: '0' },
      });
      jwtService.verify.mockReturnValue({ purpose: AUTHENTICATION_PURPOSE, challenge: 'auth-challenge' });
      mockVerifyAuthenticationResponse.mockResolvedValue({ verified: true, authenticationInfo: { newCounter: 7 } });

      const result = await service.verifyAuthentication('token', { id: 'cred-id' } as never);

      expect(credentialRepo.update).toHaveBeenCalledWith({ id: 'credential-1' }, { counter: '7' });
      expect(result).toEqual({ deviceIdentityId: DEVICE_IDENTITY_ID });
    });

    test('test_verifyAuthentication_challengeTokenInvalidOrExpired_throwsUnauthorized', async () => {
      const { service, jwtService } = buildService();
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.verifyAuthentication('expired-token', { id: 'cred-id' } as never)).rejects.toThrow(UnauthorizedException);
    });
  });
});
