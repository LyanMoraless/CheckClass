import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { DeviceAuthService } from './device-auth.service';

function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

// Device -> Gateway authentication. Runs before any tenant context exists, so
// it deliberately bypasses normal RLS scoping via a SECURITY DEFINER function
// (see AddDeviceApiKey migration) — the DataSource.query call here IS that
// function call, mocked at the unit level.
describe('DeviceAuthService', () => {
  const validSecret = 'super-secret-value';
  const activeDeviceRow = {
    device_id: 'device-1',
    tenant_id: 'tenant-a-id',
    api_key_secret_hash: hashSecret(validSecret),
    status: 'active',
  };

  function buildService(queryResult: unknown[]) {
    const dataSource = { query: jest.fn().mockResolvedValue(queryResult) };
    const service = new DeviceAuthService(dataSource as never);
    return { service, dataSource };
  }

  test('test_authenticate_validKeyAndActiveDevice_returnsAuthenticatedDevice', async () => {
    const { service, dataSource } = buildService([activeDeviceRow]);

    const result = await service.authenticate(`device-1.${validSecret}`);

    expect(result).toEqual({ deviceId: 'device-1', tenantId: 'tenant-a-id' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT * FROM resolve_device_by_api_key_id($1)', ['device-1']);
  });

  test('test_authenticate_wrongSecret_throwsUnauthorized', async () => {
    const { service } = buildService([activeDeviceRow]);

    await expect(service.authenticate('device-1.wrong-secret')).rejects.toThrow(UnauthorizedException);
  });

  test('test_authenticate_malformedKeyWithNoSeparator_throwsUnauthorized', async () => {
    const { service } = buildService([activeDeviceRow]);

    await expect(service.authenticate('device-1-and-secret-with-no-dot')).rejects.toThrow(UnauthorizedException);
  });

  test('test_authenticate_malformedKeyWithEmptyApiKeyIdPrefix_throwsUnauthorized', async () => {
    const { service } = buildService([activeDeviceRow]);

    await expect(service.authenticate(`.${validSecret}`)).rejects.toThrow(UnauthorizedException);
  });

  test('test_authenticate_malformedKeyWithEmptySecretSuffix_throwsUnauthorized', async () => {
    const { service } = buildService([activeDeviceRow]);

    await expect(service.authenticate('device-1.')).rejects.toThrow(UnauthorizedException);
  });

  test('test_authenticate_unknownApiKeyId_throwsUnauthorized', async () => {
    const { service } = buildService([]);

    await expect(service.authenticate(`unknown-device.${validSecret}`)).rejects.toThrow(UnauthorizedException);
  });

  test('test_authenticate_inactiveDevice_throwsForbidden', async () => {
    const { service } = buildService([{ ...activeDeviceRow, status: 'disabled' }]);

    await expect(service.authenticate(`device-1.${validSecret}`)).rejects.toThrow(ForbiddenException);
  });

  test('test_authenticate_secretWithDifferentLength_throwsUnauthorizedWithoutCrashing', async () => {
    // timingSafeEqual throws on mismatched buffer lengths if not guarded —
    // this must resolve to a normal auth failure, not an unhandled error.
    const { service } = buildService([activeDeviceRow]);

    await expect(service.authenticate('device-1.short')).rejects.toThrow(UnauthorizedException);
  });
});
