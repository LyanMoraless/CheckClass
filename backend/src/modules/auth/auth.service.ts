import { Injectable, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcrypt';
import { DataSource } from 'typeorm';

interface ResolvedPerson {
  person_id: string;
  tenant_id: string;
  password_hash: string;
}

export interface AuthenticatedPerson {
  personId: string;
  tenantId: string;
}

// Fixed placeholder hash to compare against when a CPF doesn't resolve to
// any credential — same reasoning as DeviceAuthService's dummy comparison:
// without this, "unknown CPF" would skip bcrypt entirely and be measurably
// faster than "known CPF, wrong password", a timing side-channel for
// enumerating which CPFs have accounts. This is a real bcrypt hash (not a
// plain string) so the compare() call underneath does equivalent work.
const DUMMY_PASSWORD_HASH = '$2b$10$CwaJ8YRt8/rHOG9Ry6IcpupvOWFVIDPVnzQ9x/nD1yWv1XG5Qh0Vi';

// Runs BEFORE any tenant context exists — same shape as DeviceAuthService:
// CPF is globally unique per real person (confirmed 2026-08-22, which is
// exactly why it was chosen over RA — RA is only unique within one
// institution), resolved via the resolve_person_by_cpf() SECURITY DEFINER
// function (AddAuthAndPermissionGroups migration), the one sanctioned way to
// look a person up across tenants before their tenant is known.
@Injectable()
export class AuthService {
  constructor(private readonly dataSource: DataSource) {}

  async login(cpf: string, password: string): Promise<AuthenticatedPerson> {
    const rows: ResolvedPerson[] = await this.dataSource.query('SELECT * FROM resolve_person_by_cpf($1)', [cpf]);
    const resolved = rows[0];

    const passwordIsValid = await compare(password, resolved?.password_hash ?? DUMMY_PASSWORD_HASH);
    if (!resolved || !passwordIsValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return { personId: resolved.person_id, tenantId: resolved.tenant_id };
  }
}
