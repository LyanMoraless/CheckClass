import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { IsNull, QueryFailedError } from 'typeorm';
import { DeviceIdentityEntity, PersonalDeviceEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';

const UNIQUE_VIOLATION = '23505';

// BYOD self-service (RULE-DEV-02/17/18). "Matrícula funciona igual para
// máquina institucional e para BYOD" refers to the shared WebAuthn credential
// capability (DeviceCredentialService) — this service only owns the
// personal_device inventory row itself (RULE-DEV-04's four field groups
// never apply here, this is deliberately enxuto).
@Injectable()
export class PersonalDeviceService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
  ) {}

  async register(personId: string, label: string | null): Promise<PersonalDeviceEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // RULE-DEV-17: one active BYOD per person. Checked defensively before
    // the insert — the DB partial unique index (personal_device_one_active_
    // per_person_unique, AddDeviceBinding migration) is the final safety
    // net for the race, not the primary UX.
    const existingActive = await manager.getRepository(PersonalDeviceEntity).findOneBy({ personId, revokedAt: IsNull() });
    if (existingActive) {
      throw new ConflictException(`Person ${personId} already has an active personal device (RULE-DEV-17) — revoke it first`);
    }

    const identityRepository = manager.getRepository(DeviceIdentityEntity);
    const identity = await identityRepository.save(identityRepository.create({ tenantId }));

    const repository = manager.getRepository(PersonalDeviceEntity);
    try {
      return await repository.save(
        repository.create({ id: identity.id, tenantId, personId, label: label ?? null, revokedAt: null, revokedByPersonId: null }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string } | undefined)?.code === UNIQUE_VIOLATION) {
        throw new ConflictException(`Person ${personId} already has an active personal device (RULE-DEV-17)`);
      }
      throw error;
    }
  }

  async getMine(personId: string): Promise<PersonalDeviceEntity | null> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(PersonalDeviceEntity).findOneBy({ personId, revokedAt: IsNull() });
  }

  // RULE-DEV-18 admin flow: the inventory administrator (Direção/Reitoria,
  // RULE-DEV-15) looks up a person's active BYOD by personId before deciding
  // whether to revoke it administratively — getMine() only ever resolves the
  // CALLER's own personId from the JWT, so it can't serve an admin searching
  // for someone else's device. Same Direção/Reitoria check as revoke()'s
  // admin branch below (LeadershipScopeService.getCourseScope(...)
  // .allCourses), not a Permission enum code — RULE-ACC-08 confirms none
  // exists for inventory administration. Deliberately NOT opened to
  // Coordenação: RULE-DEV-15's 2026-09-11 widening only reaches
  // *visualização* of the institutional-machine inventory, never BYOD
  // administration/revocation.
  async findByPerson(personId: string, requesterPersonId: string): Promise<PersonalDeviceEntity | null> {
    const scope = await this.leadershipScope.getCourseScope(requesterPersonId);
    if (!scope.allCourses) {
      throw new ForbiddenException(
        `Person ${requesterPersonId} has no Direção/Reitoria authority to search the personal device inventory (RULE-DEV-15)`,
      );
    }

    const manager = this.tenantContext.getManager();
    return manager.getRepository(PersonalDeviceEntity).findOneBy({ personId, revokedAt: IsNull() });
  }

  // RULE-DEV-18: the owner themself (self-service) OR the inventory
  // administrator (Direção/Reitoria, RULE-DEV-15) — both authorized, neither
  // exclusive.
  async revoke(id: string, requesterPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(PersonalDeviceEntity);
    const device = await repository.findOneBy({ id });
    if (!device) {
      throw new NotFoundException(`personal_device ${id} not found`);
    }
    if (device.revokedAt) {
      return; // Already revoked — idempotent no-op, same posture as device-binding's checkout.
    }

    if (device.personId !== requesterPersonId) {
      const scope = await this.leadershipScope.getCourseScope(requesterPersonId);
      if (!scope.allCourses) {
        throw new ForbiddenException(
          `Person ${requesterPersonId} may not revoke personal_device ${id} — neither its owner nor Direção/Reitoria (RULE-DEV-18)`,
        );
      }
    }

    await repository.update({ id }, { revokedAt: new Date(), revokedByPersonId: requesterPersonId });
  }
}
