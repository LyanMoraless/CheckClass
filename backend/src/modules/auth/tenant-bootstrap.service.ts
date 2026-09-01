import { ConflictException, Injectable } from '@nestjs/common';
import { hash } from 'bcrypt';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import {
  ActorTypeEntity,
  LeadershipAssignmentEntity,
  LeadershipRoleEntity,
  PersonCredentialEntity,
  PersonEntity,
  TenantEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { Permission } from './permission.enum';
import { PermissionGroupService } from './permission-group.service';

const BCRYPT_SALT_ROUNDS = 10;

// RULE-INST-01: only "faculdade" has a leadership hierarchy defined this
// round (actors.md, "Hierarquia de liderança — Faculdade") — escola/empresa
// stay without one, so no leadership_role/leadership_assignment seeding
// happens for them.
const FACULDADE_INSTITUTION_TYPE = 'faculdade';

// Names/ranks per actors.md's confirmed chain: Aluno (not a leadership_role
// — the base subject to apuração, no resolution authority) -> Professor ->
// Coordenador de Curso -> Direção/Reitoria. Rank is a plain 1..N climbing
// the chain; nothing downstream reads specific rank values yet (RULE-INST-09
// authorizes purely by assignment scope, not by comparing ranks), so this is
// just a stable ordering, not a load-bearing number.
// "Professor" must match TEACHER_LEADERSHIP_ROLE_NAME in
// class-group.service.ts EXACTLY — RULE-INST-05's automatic-grant lookup is
// name-based, and a mismatch here would silently break it for every
// faculdade tenant.
const FACULDADE_LEADERSHIP_ROLES: ReadonlyArray<{ name: string; rank: number }> = [
  { name: 'Professor', rank: 1 },
  { name: 'Coordenador de Curso', rank: 2 },
  { name: 'Direção/Reitoria', rank: 3 },
];

const TOP_LEADERSHIP_ROLE_NAME = 'Direção/Reitoria';

// RULE-INST-01: fixed 3-value institution-type enum. Shared with
// CreateInstitutionOnboardingDto's @IsIn (institution-onboarding module) so
// the public onboarding DTO and this service never drift out of sync on the
// valid-values list — same precedent as ENROLLMENT_STATUSES in
// class-group.service.ts.
export const INSTITUTION_TYPES = ['faculdade', 'escola', 'empresa'] as const;

export interface CreateTenantInput {
  institutionName: string;
  institutionType: string;
  rootFullName: string;
  rootCpf: string;
  rootPassword: string;
  // RULE-INST-02: collected by the public self-service onboarding screen
  // (institution-onboarding module). Optional here — not on the DTO that
  // module exposes — because the pre-existing tenant-create.ts CLI path
  // (test/CI only, per RULE-INST-02's second-round update) doesn't supply
  // them and must not be forced to. Persisted as-is when provided; see
  // tenant.entity.ts for why these columns are nullable at the DB level.
  cnpj?: string;
  addressStreet?: string;
  addressNumber?: string;
  addressComplement?: string;
  addressNeighborhood?: string;
  addressCity?: string;
  addressState?: string;
  addressZipCode?: string;
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
      tenantRepository.create({
        name: input.institutionName,
        institutionType: input.institutionType,
        cnpj: input.cnpj ?? null,
        addressStreet: input.addressStreet ?? null,
        addressNumber: input.addressNumber ?? null,
        addressComplement: input.addressComplement ?? null,
        addressNeighborhood: input.addressNeighborhood ?? null,
        addressCity: input.addressCity ?? null,
        addressState: input.addressState ?? null,
        addressZipCode: input.addressZipCode ?? null,
      }),
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

    // RULE-INST-09's cumulative check means MANAGE_INSTITUTION_STRUCTURE
    // above is necessary but not sufficient to montar/editar turma — without
    // a leadership_assignment too, the root admin would be ForbiddenException'd
    // on their very first attempt, with no other bootstrap path to grant one.
    if (input.institutionType === FACULDADE_INSTITUTION_TYPE) {
      await this.seedFacultyLeadershipChain(manager, tenantId, rootPerson.id);
    }

    return { tenantId, rootPersonId: rootPerson.id, rootPermissionGroupId: rootGroup.id };
  }

  // Seeds the three real leadership_role rows of the faculdade chain
  // (actors.md) and grants the root person the top one, institution-wide
  // (courseId/classGroupId both NULL — the same NULL-scope pattern
  // RULE-INST-09's update already uses for Direção/Reitoria's automatic
  // authority over every course). Aluno is deliberately not created here —
  // it is the base of the chain, not a leadership_role (actors.md).
  private async seedFacultyLeadershipChain(manager: EntityManager, tenantId: string, rootPersonId: string): Promise<void> {
    const roleRepository = manager.getRepository(LeadershipRoleEntity);
    const roles = await roleRepository.save(
      FACULDADE_LEADERSHIP_ROLES.map((role) => roleRepository.create({ tenantId, name: role.name, rank: role.rank })),
    );

    const topRole = roles.find((role) => role.name === TOP_LEADERSHIP_ROLE_NAME);
    if (!topRole) {
      // Unreachable outside of a future edit mistake to the static array
      // above — fails loudly instead of silently leaving the root person
      // without any leadership authority.
      throw new Error(`leadership_role "${TOP_LEADERSHIP_ROLE_NAME}" missing right after seeding it`);
    }

    const assignmentRepository = manager.getRepository(LeadershipAssignmentEntity);
    await assignmentRepository.save(
      assignmentRepository.create({
        tenantId,
        personId: rootPersonId,
        leadershipRoleId: topRole.id,
        courseId: null,
        classGroupId: null,
      }),
    );
  }
}
