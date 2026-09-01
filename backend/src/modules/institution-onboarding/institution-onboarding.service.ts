import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { DataSource, QueryFailedError } from 'typeorm';
import { isValidCnpj, stripCnpjMask } from '../../common/cnpj.util';
import { CreatedTenant, TenantBootstrapService } from '../auth/tenant-bootstrap.service';

const UNIQUE_VIOLATION = '23505';

export interface OnboardInstitutionInput {
  institutionName: string;
  cnpj: string;
  institutionType: string;
  addressZipCode: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement?: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  rootFullName: string;
  rootCpf: string;
  rootPassword: string;
}

const ZIP_CODE_DIGIT_COUNT = 8;

// Local, zip-code-specific mask stripper — deliberately not a reuse of
// cnpj.util's stripCnpjMask (that name is CNPJ-scoped; the two masks are
// unrelated even though the character-stripping logic looks identical).
function stripNonDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// RULE-INST-02: the public, pre-authentication institution-creation screen.
// Reuses TenantBootstrapService (the only sanctioned tenant creator) rather
// than duplicating its provisioning logic — this service only adds the
// onboarding-specific concerns TenantBootstrapService itself doesn't own:
// the single-instance lock and CNPJ check-digit validation.
@Injectable()
export class InstitutionOnboardingService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantBootstrap: TenantBootstrapService,
  ) {}

  // Lets the frontend decide, before ever rendering the onboarding form,
  // whether to redirect straight to the login screen with a message
  // (RULE-INST-02, third round, item #3) instead of showing a form that
  // would only fail on submit.
  async getStatus(): Promise<{ configured: boolean }> {
    return { configured: await this.isInstanceLocked() };
  }

  async onboard(input: OnboardInstitutionInput): Promise<CreatedTenant> {
    // RULE-INST-02: the tela never creates a second institution on the same
    // instance/deploy. GET /status above is the primary UX signal for the
    // frontend to redirect before even showing the form; this fast-path
    // check is a cheap early exit for the common case, NOT what actually
    // prevents the race — acquireInstanceLock() below does that atomically.
    if (await this.isInstanceLocked()) {
      throw new ConflictException('This instance already has an institution configured — onboarding is closed.');
    }

    // RULE-INST-02 (second round, item #3): check-digit validation, rejected
    // before creating anything (tenant, root admin, or otherwise).
    if (!isValidCnpj(input.cnpj)) {
      throw new BadRequestException('cnpj is not a valid CNPJ (check-digit validation failed)');
    }

    const addressZipCode = stripNonDigits(input.addressZipCode);
    if (addressZipCode.length !== ZIP_CODE_DIGIT_COUNT) {
      throw new BadRequestException('addressZipCode must contain exactly 8 digits (with or without mask)');
    }

    // Security-review finding: the check-then-act gap between the
    // isInstanceLocked() check above and TenantBootstrapService.createTenant
    // below let two concurrent onboarding requests both pass the check and
    // each create a tenant, violating RULE-INST-02's single-instance
    // guarantee. This INSERT is what actually closes that gap: instance_lock
    // (AddInstanceLock migration) has a single-row primary key, so Postgres
    // itself rejects a second concurrent INSERT with a unique-violation — the
    // race is resolved by the database, not by request timing.
    await this.acquireInstanceLock();

    try {
      return await this.tenantBootstrap.createTenant({
        institutionName: input.institutionName,
        institutionType: input.institutionType,
        rootFullName: input.rootFullName,
        rootCpf: input.rootCpf,
        rootPassword: input.rootPassword,
        // Stored unmasked, matching tenant.cnpj's varchar(14) column — the
        // endpoint accepts either format, but persistence always normalizes.
        cnpj: stripCnpjMask(input.cnpj),
        addressStreet: input.addressStreet,
        addressNumber: input.addressNumber,
        addressComplement: input.addressComplement,
        addressNeighborhood: input.addressNeighborhood,
        addressCity: input.addressCity,
        addressState: input.addressState.toUpperCase(),
        addressZipCode,
      });
    } catch (error) {
      // Compensating cleanup on failure — same reasoning as
      // TenantBootstrapService.createTenant's own tenant-row cleanup: if
      // provisioning fails for any reason (e.g. a duplicate CPF), the lock
      // must not be left permanently held with no institution behind it,
      // or this instance would be locked out of onboarding forever.
      await this.releaseInstanceLock();
      throw error;
    }
  }

  private async isInstanceLocked(): Promise<boolean> {
    const rows = await this.dataSource.query('SELECT 1 FROM instance_lock LIMIT 1');
    return rows.length > 0;
  }

  private async acquireInstanceLock(): Promise<void> {
    try {
      await this.dataSource.query('INSERT INTO instance_lock DEFAULT VALUES');
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        throw new ConflictException('This instance already has an institution configured — onboarding is closed.');
      }
      throw error;
    }
  }

  private async releaseInstanceLock(): Promise<void> {
    await this.dataSource.query('DELETE FROM instance_lock');
  }
}
