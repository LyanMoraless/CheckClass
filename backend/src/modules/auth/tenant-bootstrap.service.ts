import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { DataSource, QueryFailedError } from 'typeorm';
import { ActorTypeEntity, PersonCredentialEntity, PersonEntity, TenantEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { Permission } from './permission.enum';
import { PermissionGroupService } from './permission-group.service';

const BCRYPT_SALT_ROUNDS = 10;

export interface CreateTenantInput {
  institutionName: string;
  institutionType: string;
  rootFullName: string;
  rootCpf: string;
  rootPassword: string;
}

export interface CreatedTenant {
  tenantId: string;
  rootPersonId: string;
  rootPermissionGroupId: string;
}

// The only sanctioned way a new institution comes into being. Creating the
// tenant row itself happens outside any tenant context (there's nothing to
// scope to yet, and `tenant` has no RLS policy of its own — see InitSchema),
// then everything else runs inside runWithTenant(newTenantId, ...) exactly
// like a normal request would, so it picks up the same RLS-bearing
// transaction as everything else in the codebase.
@Injectable()
export class TenantBootstrapService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
    private readonly permissionGroupService: PermissionGroupService,
  ) {}

  async createTenant(input: CreateTenantInput): Promise<CreatedTenant> {
    const tenantRepository = this.dataSource.getRepository(TenantEntity);
    const tenant = await tenantRepository.save(
      tenantRepository.create({ name: input.institutionName, institutionType: input.institutionType }),
    );

    // Code review finding: the tenant row can't live inside runWithTenant's
    // transaction (it has to exist before there's a tenant to scope to), so
    // it isn't atomic with everything below by construction. If that inner
    // block fails for ANY reason (a duplicate CPF being the obvious one,
    // since person_credential.cpf is globally unique), the tenant row would
    // otherwise be left behind permanently — an institution that exists in
    // the DB but has no admin, no root group, and no way back in. Clean it
    // up explicitly on failure instead of leaving an orphan.
    try {
      return await this.tenantContext.runWithTenant(tenant.id, () => this.provisionRootAdmin(tenant.id, input));
    } catch (error) {
      await tenantRepository.delete({ id: tenant.id });
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === '23505') {
        throw new ConflictException('CPF already has an account (CPF must be unique across the whole platform)');
      }
      throw error;
    }
  }

  private async provisionRootAdmin(tenantId: string, input: CreateTenantInput): Promise<CreatedTenant> {
    const manager = this.tenantContext.getManager();

    // Every tenant needs at least one actor_type row for its people to
    // reference (person.actor_type_id is NOT NULL) — ADMIN covers the root
    // account; the institution defines its real actor types (STUDENT,
    // TEACHER, etc.) separately as it onboards people.
    const actorTypeRepository = manager.getRepository(ActorTypeEntity);
    const adminActorType = await actorTypeRepository.save(
      actorTypeRepository.create({ tenantId, code: 'ADMIN', name: 'Administrator' }),
    );

    const personRepository = manager.getRepository(PersonEntity);
    const rootPerson = await personRepository.save(
      personRepository.create({ tenantId, actorTypeId: adminActorType.id, fullName: input.rootFullName }),
    );

    const passwordHash = await hash(input.rootPassword, BCRYPT_SALT_ROUNDS);
    const credentialRepository = manager.getRepository(PersonCredentialEntity);
    await credentialRepository.save(
      credentialRepository.create({ tenantId, personId: rootPerson.id, cpf: input.rootCpf, passwordHash }),
    );

    const rootGroup = await this.permissionGroupService.createGroup('Root', Object.values(Permission));
    await this.permissionGroupService.assignPersonToGroup(rootPerson.id, rootGroup.id);

    return { tenantId, rootPersonId: rootPerson.id, rootPermissionGroupId: rootGroup.id };
  }
}
