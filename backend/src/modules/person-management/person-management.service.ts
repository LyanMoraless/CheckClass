import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { ActorTypeEntity, PersonCredentialEntity, PersonEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

const BCRYPT_SALT_ROUNDS = 10;
const UNIQUE_VIOLATION = '23505';

export interface CreatePersonInput {
  fullName: string;
  actorTypeCode: string;
  cpf?: string;
  password?: string;
}

export interface CreatedPerson {
  personId: string;
  actorTypeId: string;
}

// Minimal "manage users" capability behind the MANAGE_USERS permission
// (confirmed 2026-08-22) — create a person, optionally with login
// credentials. Group assignment is a separate call
// (PermissionGroupService.assignPersonToGroup), already built in the auth
// module.
@Injectable()
export class PersonManagementService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async createPerson(input: CreatePersonInput): Promise<CreatedPerson> {
    if (Boolean(input.cpf) !== Boolean(input.password)) {
      // Code review finding: previously silently skipped credential
      // creation when only one of the two was set, with no signal to the
      // caller that a login was NOT created.
      throw new BadRequestException('cpf and password must both be provided, or neither');
    }

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const actorType = await this.findOrCreateActorType(input.actorTypeCode);

    const personRepository = manager.getRepository(PersonEntity);
    const person = await personRepository.save(
      personRepository.create({ tenantId, actorTypeId: actorType.id, fullName: input.fullName }),
    );

    if (input.cpf && input.password) {
      await this.createCredential(tenantId, person.id, input.cpf, input.password);
    }

    return { personId: person.id, actorTypeId: actorType.id };
  }

  private async findOrCreateActorType(code: string): Promise<ActorTypeEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const actorTypeRepository = manager.getRepository(ActorTypeEntity);

    const existing = await actorTypeRepository.findOneBy({ code });
    if (existing) {
      return existing;
    }

    // Code review finding: plain find-then-create raced under concurrent
    // calls for the same not-yet-existing code (no DB constraint backed the
    // "one row per tenant+code" assumption). Insert-or-ignore against the
    // new UNIQUE(tenant_id, code) constraint (AddActorTypeCodeUnique
    // migration), then re-select on the losing side of the race instead of
    // ending up with two rows for the same logical actor type.
    const insertResult = await manager
      .createQueryBuilder()
      .insert()
      .into(ActorTypeEntity)
      .values({ tenantId, code, name: code })
      .orIgnore()
      .returning(['id'])
      .execute();

    const insertedId = insertResult.identifiers[0]?.id as string | undefined;
    if (insertedId) {
      return actorTypeRepository.findOneByOrFail({ id: insertedId });
    }
    return actorTypeRepository.findOneByOrFail({ code });
  }

  private async createCredential(tenantId: string, personId: string, cpf: string, password: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const passwordHash = await hash(password, BCRYPT_SALT_ROUNDS);
    const credentialRepository = manager.getRepository(PersonCredentialEntity);
    try {
      await credentialRepository.save(credentialRepository.create({ tenantId, personId, cpf, passwordHash }));
    } catch (error) {
      // Security review finding: this previously fell through to an
      // unhandled 500, which also acted as a cross-tenant enumeration
      // side-channel (500 vs 201 disclosed whether a CPF had an account
      // ANYWHERE in the system, not just this tenant).
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        throw new ConflictException('CPF already has an account (CPF must be unique across the whole platform)');
      }
      throw error;
    }
  }
}
