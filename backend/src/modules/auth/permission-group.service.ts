import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionGroupEntity, PermissionGroupPermissionEntity, PersonEntity, PersonPermissionGroupEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { Permission } from './permission.enum';

// Configurable permission groups (confirmed 2026-08-22): NOT the same
// mechanism as RULE-ATT-12's leadership chain, which stays the specific
// authority for resolving attendance pending reviews. This covers general
// institutional management instead — every tenant gets one root group at
// bootstrap (TenantBootstrapService) holding every permission, and can
// create further groups of its own with whatever subset it chooses.
@Injectable()
export class PermissionGroupService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async createGroup(name: string, permissions: Permission[]): Promise<PermissionGroupEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const groupRepository = manager.getRepository(PermissionGroupEntity);
    const group = await groupRepository.save(groupRepository.create({ tenantId, name }));

    if (permissions.length > 0) {
      const permissionRepository = manager.getRepository(PermissionGroupPermissionEntity);
      const rows = permissions.map((permissionCode) =>
        permissionRepository.create({ tenantId, permissionGroupId: group.id, permissionCode }),
      );
      await permissionRepository.save(rows);
    }

    return group;
  }

  async assignPersonToGroup(personId: string, permissionGroupId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // Security/code-review finding: neither id was previously checked
    // against the caller's own tenant — findOneBy runs through the
    // RLS-scoped manager, so a cross-tenant id simply won't be found here
    // (rather than silently inserting a row that references another
    // tenant's person/group via the bare FK, which has no RLS of its own).
    const person = await manager.getRepository(PersonEntity).findOneBy({ id: personId });
    if (!person) {
      throw new NotFoundException(`person ${personId} not found`);
    }
    const group = await manager.getRepository(PermissionGroupEntity).findOneBy({ id: permissionGroupId });
    if (!group) {
      throw new NotFoundException(`permission_group ${permissionGroupId} not found`);
    }

    const repository = manager.getRepository(PersonPermissionGroupEntity);
    const existing = await repository.findOneBy({ personId, permissionGroupId });
    if (existing) {
      return; // already a member — assigning again is a no-op, not an error
    }
    await repository.save(repository.create({ tenantId, personId, permissionGroupId }));
  }

  // Added for the admin frontend: the "assign member" screen needs a list of
  // existing groups to pick from (no other consumer needs this yet).
  async listGroups(): Promise<Array<{ id: string; name: string; permissions: Permission[] }>> {
    const manager = this.tenantContext.getManager();
    const groups = await manager.getRepository(PermissionGroupEntity).find({ order: { name: 'ASC' } });
    const permissionRows = await manager.getRepository(PermissionGroupPermissionEntity).find();

    return groups.map((group) => ({
      id: group.id,
      name: group.name,
      permissions: permissionRows
        .filter((row) => row.permissionGroupId === group.id)
        .map((row) => row.permissionCode as Permission),
    }));
  }

  // A person can belong to more than one group; any one of them granting the
  // permission is enough (same "any role in the chain authorizes" spirit as
  // RULE-ATT-12, applied here to general management instead).
  async hasPermission(personId: string, permission: Permission): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const count: Array<{ count: string }> = await manager.query(
      `
      SELECT count(*) FROM person_permission_group ppg
      JOIN permission_group_permission pgp ON pgp.permission_group_id = ppg.permission_group_id
      WHERE ppg.person_id = $1 AND pgp.permission_code = $2
      `,
      [personId, permission],
    );
    return Number(count[0].count) > 0;
  }

  // Security review finding: without this, any MANAGE_USERS holder could
  // create a group with EVERY permission and assign themselves to it —
  // self-escalating to full admin. The controller uses this to cap a
  // group-creation request to permissions the caller already holds.
  async getPermissionsForPerson(personId: string): Promise<Permission[]> {
    const manager = this.tenantContext.getManager();
    const rows: Array<{ permission_code: Permission }> = await manager.query(
      `
      SELECT DISTINCT pgp.permission_code FROM person_permission_group ppg
      JOIN permission_group_permission pgp ON pgp.permission_group_id = ppg.permission_group_id
      WHERE ppg.person_id = $1
      `,
      [personId],
    );
    return rows.map((row) => row.permission_code);
  }
}
