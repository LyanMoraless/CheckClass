import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { CourseEntity, DeviceIdentityEntity, InstitutionalMachineEntity, RoomEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { InstitutionalMachineStatus } from './institutional-machine-status.enum';

const UNIQUE_VIOLATION = '23505';

export interface CreateInstitutionalMachineInput {
  assetTag: string;
  serialNumber: string;
  roomId: string;
  status: InstitutionalMachineStatus;
  brand: string;
  model: string;
  processor: string;
  memoryDescription: string;
  operatingSystem: string;
  courseId: string;
}

export type UpdateInstitutionalMachineInput = Partial<CreateInstitutionalMachineInput>;

// RULE-DEV-04's inventory of institutional machines. RULE-DEV-15: cadastrar/
// editar/dar baixa is gated by Direção/Reitoria authority, checked via
// LeadershipScopeService (the same mechanism RULE-ATT-12 already uses) —
// RULE-ACC-08 confirms there is deliberately NO dedicated Permission enum
// code for this (unlike RULE-DEV-13's read side, which does get one).
// RULE-DEV-05: courseId is pure inventory metadata here, never read for
// login authorization — nothing in this service (or anywhere else in Frente
// 12) treats it as an authorization signal.
@Injectable()
export class InstitutionalMachineService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
  ) {}

  async create(input: CreateInstitutionalMachineInput, authenticatedPersonId: string): Promise<InstitutionalMachineEntity> {
    await this.assertDirectionAuthority(authenticatedPersonId);

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const room = await manager.getRepository(RoomEntity).findOneBy({ id: input.roomId });
    if (!room) {
      throw new NotFoundException(`room ${input.roomId} not found`);
    }
    const course = await manager.getRepository(CourseEntity).findOneBy({ id: input.courseId });
    if (!course) {
      throw new NotFoundException(`course ${input.courseId} not found`);
    }

    // device_identity is the shared supertype anchor (device-identity.entity.ts) —
    // written here, in the same request-scoped transaction as the subtype row
    // below (TenantContextService.runWithTenant already wraps the whole
    // request), never independently. See that entity's header comment.
    const identityRepository = manager.getRepository(DeviceIdentityEntity);
    const identity = await identityRepository.save(identityRepository.create({ tenantId }));

    const repository = manager.getRepository(InstitutionalMachineEntity);
    try {
      return await repository.save(
        repository.create({
          id: identity.id,
          tenantId,
          assetTag: input.assetTag,
          serialNumber: input.serialNumber,
          roomId: input.roomId,
          status: input.status,
          brand: input.brand,
          model: input.model,
          processor: input.processor,
          memoryDescription: input.memoryDescription,
          operatingSystem: input.operatingSystem,
          courseId: input.courseId,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION) {
        // institutional_machine_asset_tag_unique / _serial_number_unique
        // (AddDeviceBinding migration) — a Database Agent integrity decision,
        // not a business rule, but still deserves a clear 409 over a raw
        // Postgres error.
        throw new ConflictException(
          `assetTag "${input.assetTag}" or serialNumber "${input.serialNumber}" is already registered for this institution`,
        );
      }
      throw error;
    }
  }

  // Backend Agent decision, not dictated by any of RULE-DEV-04/13/15/16:
  // business rules only name Direção/Reitoria for cadastrar/editar/dar baixa
  // (RULE-DEV-15) and coordenação+direção for the SEPARATE device-BINDING
  // history code (RULE-DEV-13/RULE-ACC-08) — nobody was named for plain
  // inventory listing. Defaulting to deny (security skill: "default to
  // denying access; grant explicitly") and reusing the same Direção/Reitoria
  // gate for reads too, rather than leaving this controller's list/get
  // routes open to any authenticated person. If a broader viewer role (e.g.
  // coordenação, to cross-reference RULE-DEV-13's deviceIdentityId against a
  // friendly asset tag) is needed later, that is a product decision to
  // revisit, not one to presume here.
  async list(authenticatedPersonId: string): Promise<InstitutionalMachineEntity[]> {
    await this.assertDirectionAuthority(authenticatedPersonId);
    const manager = this.tenantContext.getManager();
    return manager.getRepository(InstitutionalMachineEntity).find({ order: { assetTag: 'ASC' } });
  }

  async get(id: string, authenticatedPersonId: string): Promise<InstitutionalMachineEntity> {
    await this.assertDirectionAuthority(authenticatedPersonId);
    const manager = this.tenantContext.getManager();
    const machine = await manager.getRepository(InstitutionalMachineEntity).findOneBy({ id });
    if (!machine) {
      throw new NotFoundException(`institutional_machine ${id} not found`);
    }
    return machine;
  }

  async update(id: string, input: UpdateInstitutionalMachineInput, authenticatedPersonId: string): Promise<InstitutionalMachineEntity> {
    await this.assertDirectionAuthority(authenticatedPersonId);

    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(InstitutionalMachineEntity);
    const machine = await repository.findOneBy({ id });
    if (!machine) {
      throw new NotFoundException(`institutional_machine ${id} not found`);
    }

    if (input.roomId) {
      const room = await manager.getRepository(RoomEntity).findOneBy({ id: input.roomId });
      if (!room) {
        throw new NotFoundException(`room ${input.roomId} not found`);
      }
    }
    if (input.courseId) {
      const course = await manager.getRepository(CourseEntity).findOneBy({ id: input.courseId });
      if (!course) {
        throw new NotFoundException(`course ${input.courseId} not found`);
      }
    }

    try {
      await repository.update({ id }, input);
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION) {
        throw new ConflictException(`assetTag/serialNumber conflict with another machine already registered for this institution`);
      }
      throw error;
    }
    // authenticatedPersonId already re-verified via assertDirectionAuthority
    // above in this same call — passed through again only because get()'s
    // signature requires it, not because a second check is needed.
    return this.get(id, authenticatedPersonId);
  }

  // RULE-DEV-15: Direção/Reitoria, reusing the exact mechanism RULE-ATT-12
  // (via LeadershipScopeService) already established, not a new permission
  // code (RULE-ACC-08's addendum). getCourseScope(...).allCourses is the
  // same institution-wide signal MeContextService.isDirection already
  // exposes — an institution-wide leadership_assignment (courseId NULL),
  // which RULE-INST-09 automatically grants the Direção/Reitoria role.
  private async assertDirectionAuthority(personId: string): Promise<void> {
    const scope = await this.leadershipScope.getCourseScope(personId);
    if (!scope.allCourses) {
      throw new ForbiddenException(
        `Person ${personId} has no Direção/Reitoria authority to administer the institutional machine inventory (RULE-DEV-15)`,
      );
    }
  }
}
