import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as ipaddr from 'ipaddr.js';
import { QueryFailedError } from 'typeorm';
import { InstitutionalNetworkRangeEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

const UNIQUE_VIOLATION = '23505';
const INVALID_TEXT_REPRESENTATION = '22P02';

export interface CreateInstitutionalNetworkRangeInput {
  cidr: string;
  label?: string;
}

export type UpdateInstitutionalNetworkRangeInput = Partial<CreateInstitutionalNetworkRangeInput>;

// GAP-10 (RULE-DEV-14) admin CRUD for the tenant's allowlist of CIDR ranges
// (cadastrar/listar/editar/remover). Gated by the same Direção/Reitoria
// authority as InstitutionalMachineService (RULE-DEV-15) and
// DeviceBindingConfigService.upsert — neither RULE-DEV-14 nor the Tech
// Decision names a narrower titular for this table, and both of those
// existing precedents default to the institution-wide leadership gate
// (LeadershipScopeService.getCourseScope(...).allCourses) for a setting with
// no dedicated Permission enum code, rather than leaving it open to any
// authenticated person.
@Injectable()
export class InstitutionalNetworkRangeService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
  ) {}

  async create(input: CreateInstitutionalNetworkRangeInput, authenticatedPersonId: string): Promise<InstitutionalNetworkRangeEntity> {
    await this.assertDirectionAuthority(authenticatedPersonId);
    this.assertValidCidrShape(input.cidr);

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(InstitutionalNetworkRangeEntity);

    try {
      return await repository.save(repository.create({ tenantId, cidr: input.cidr, label: input.label ?? null }));
    } catch (error) {
      throw this.translateWriteError(error, input.cidr);
    }
  }

  async list(authenticatedPersonId: string): Promise<InstitutionalNetworkRangeEntity[]> {
    await this.assertDirectionAuthority(authenticatedPersonId);
    const manager = this.tenantContext.getManager();
    return manager.getRepository(InstitutionalNetworkRangeEntity).find({ order: { createdAt: 'ASC' } });
  }

  async get(id: string, authenticatedPersonId: string): Promise<InstitutionalNetworkRangeEntity> {
    await this.assertDirectionAuthority(authenticatedPersonId);
    return this.findOrFail(id);
  }

  async update(
    id: string,
    input: UpdateInstitutionalNetworkRangeInput,
    authenticatedPersonId: string,
  ): Promise<InstitutionalNetworkRangeEntity> {
    await this.assertDirectionAuthority(authenticatedPersonId);
    await this.findOrFail(id);
    if (input.cidr !== undefined) {
      this.assertValidCidrShape(input.cidr);
    }

    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(InstitutionalNetworkRangeEntity);
    try {
      await repository.update({ id }, input);
    } catch (error) {
      throw this.translateWriteError(error, input.cidr ?? '');
    }
    return this.findOrFail(id);
  }

  async remove(id: string, authenticatedPersonId: string): Promise<void> {
    await this.assertDirectionAuthority(authenticatedPersonId);
    await this.findOrFail(id);
    const manager = this.tenantContext.getManager();
    await manager.getRepository(InstitutionalNetworkRangeEntity).delete({ id });
  }

  private async findOrFail(id: string): Promise<InstitutionalNetworkRangeEntity> {
    const manager = this.tenantContext.getManager();
    const range = await manager.getRepository(InstitutionalNetworkRangeEntity).findOneBy({ id });
    if (!range) {
      throw new NotFoundException(`institutional_network_range ${id} not found`);
    }
    return range;
  }

  // Backend Agent decision, not a business rule: a fast, dependency-free
  // shape check (reusing the same ipaddr.js dependency already required for
  // InstitutionalNetworkService's match primitive) before ever reaching the
  // database, so a plainly garbage string gets a clean 400 instead of a raw
  // driver error. Does NOT replace the database's own validation (see
  // translateWriteError below) — isValidCIDR only checks parseable CIDR
  // notation, not that the address has no host bits set (e.g.
  // "192.168.1.5/24" passes this check but is still rejected by Postgres'
  // native `cidr` type — the entity/migration's own documented design).
  private assertValidCidrShape(cidr: string): void {
    if (!ipaddr.isValidCIDR(cidr)) {
      throw new BadRequestException(`"${cidr}" is not a valid CIDR range`);
    }
  }

  private translateWriteError(error: unknown, cidr: string): Error {
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string } | undefined)?.code;
      if (code === UNIQUE_VIOLATION) {
        // institutional_network_range_tenant_cidr_unique
        // (AddInstitutionalNetworkRange migration) — a Database Agent
        // integrity decision (exact-duplicate range for this tenant), same
        // 409 translation precedent as InstitutionalMachineService's
        // assetTag/serialNumber uniqueness.
        return new ConflictException(`CIDR "${cidr}" is already registered for this institution`);
      }
      if (code === INVALID_TEXT_REPRESENTATION) {
        // Postgres' native `cidr` type rejecting a network address with host
        // bits set (e.g. "192.168.1.5/24") — the one case
        // assertValidCidrShape's own isValidCIDR check above cannot catch,
        // per its own doc comment.
        return new BadRequestException(`"${cidr}" is not a valid network address (host bits set, or otherwise rejected as a CIDR range)`);
      }
    }
    return error as Error;
  }

  // RULE-DEV-15's exact mechanism (via LeadershipScopeService), reused here
  // for the same reason InstitutionalMachineService.assertDirectionAuthority
  // reuses it — RULE-ACC-08 confirms there is deliberately NO dedicated
  // Permission enum code for administering this kind of tenant-level
  // inventory/config table.
  private async assertDirectionAuthority(personId: string): Promise<void> {
    const scope = await this.leadershipScope.getCourseScope(personId);
    if (!scope.allCourses) {
      throw new ForbiddenException(
        `Person ${personId} has no Direção/Reitoria authority to administer the institutional network range allowlist (RULE-DEV-14/GAP-10)`,
      );
    }
  }
}
