import { UnauthorizedException } from '@nestjs/common';
import { hashSync } from 'bcrypt';
import { AuthService } from './auth.service';

// Human login, unified on CPF (confirmed 2026-08-22 — globally unique per
// real person, unlike RA which is only unique within one institution).
// Runs before any tenant context exists, same shape as DeviceAuthService:
// the DataSource.query call here IS the resolve_person_by_cpf() SECURITY
// DEFINER function call, mocked at the unit level.
describe('AuthService', () => {
  const validPassword = 'correct horse battery staple';
  const resolvedPersonRow = {
    person_id: 'person-1',
    tenant_id: 'tenant-a-id',
    password_hash: hashSync(validPassword, 4), // low cost factor: unit test speed, not production hashing
  };

  function buildService(queryResult: unknown[]) {
    const dataSource = { query: jest.fn().mockResolvedValue(queryResult) };
    const service = new AuthService(dataSource as never);
    return { service, dataSource };
  }

  test('test_login_validCpfAndPassword_returnsAuthenticatedPerson', async () => {
    const { service, dataSource } = buildService([resolvedPersonRow]);

    const result = await service.login('11122233344', validPassword);

    expect(result).toEqual({ personId: 'person-1', tenantId: 'tenant-a-id' });
    expect(dataSource.query).toHaveBeenCalledWith('SELECT * FROM resolve_person_by_cpf($1)', ['11122233344']);
  });

  test('test_login_wrongPassword_throwsUnauthorized', async () => {
    const { service } = buildService([resolvedPersonRow]);

    await expect(service.login('11122233344', 'wrong password')).rejects.toThrow(UnauthorizedException);
  });

  test('test_login_unknownCpf_throwsUnauthorizedWithoutCrashing', async () => {
    // No row resolved: must still run a (dummy) bcrypt compare rather than
    // short-circuit — short-circuiting would make "unknown CPF" measurably
    // faster than "known CPF, wrong password", a timing side-channel for
    // enumerating which CPFs have accounts.
    const { service } = buildService([]);

    await expect(service.login('99999999999', 'anything')).rejects.toThrow(UnauthorizedException);
  });
});
