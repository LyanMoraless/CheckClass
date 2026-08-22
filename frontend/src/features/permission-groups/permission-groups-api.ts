import { api } from '../../lib/api-client';
import type { Permission } from '../../types/permission';

export interface PermissionGroup {
  id: string;
  name: string;
  permissions: Permission[];
}

export interface CreatePermissionGroupInput {
  name: string;
  permissions: Permission[];
}

export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  return api.get('/v1/permission-groups');
}

export async function createPermissionGroup(input: CreatePermissionGroupInput): Promise<{ permissionGroupId: string }> {
  return api.post('/v1/permission-groups', input);
}

export async function assignPersonToGroup(
  permissionGroupId: string,
  personId: string,
): Promise<{ permissionGroupId: string; personId: string }> {
  return api.post(`/v1/permission-groups/${permissionGroupId}/members`, { personId });
}
