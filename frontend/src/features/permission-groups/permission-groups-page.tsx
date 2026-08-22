import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { PersonIdField } from '../../components/person-id-field';
import { errorMessage } from '../../lib/api-client';
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from '../../types/permission';
import { useAuth } from '../auth/auth-context';
import {
  assignPersonToGroup,
  createPermissionGroup,
  listPermissionGroups,
  type PermissionGroup,
} from './permission-groups-api';

export function PermissionGroupsPage() {
  const { hasPermission, permissions: ownPermissions } = useAuth();
  const canManage = hasPermission('manage_users');
  const queryClient = useQueryClient();
  const { data: groups, isLoading, error } = useQuery({ queryKey: ['permission-groups'], queryFn: listPermissionGroups });

  const [name, setName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<Permission>>(new Set());
  const createMutation = useMutation({
    mutationFn: createPermissionGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permission-groups'] });
      setName('');
      setSelectedPermissions(new Set());
    },
  });

  function togglePermission(permission: Permission) {
    setSelectedPermissions((current) => {
      const next = new Set(current);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate({ name, permissions: Array.from(selectedPermissions) });
  }

  const [groupId, setGroupId] = useState('');
  const [personId, setPersonId] = useState('');
  const assignMutation = useMutation({
    mutationFn: () => assignPersonToGroup(groupId, personId),
    onSuccess: () => setPersonId(''),
  });

  async function handleAssignSubmit(event: FormEvent) {
    event.preventDefault();
    assignMutation.mutate();
  }

  return (
    <section>
      <h1>Permission groups</h1>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {groups && (
        <DataTable<PermissionGroup>
          rows={groups}
          getRowKey={(group) => group.id}
          columns={[
            { header: 'Name', cell: (group) => group.name },
            { header: 'Permissions', cell: (group) => group.permissions.map((p) => PERMISSION_LABELS[p]).join(', ') },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>New permission group</legend>
        {!canManage && <PermissionHint permission="manage_users" />}
        <p>
          <small>The server caps this to permissions you already hold yourself (no self-escalation).</small>
        </p>
        <form onSubmit={handleCreateSubmit}>
          {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
          <label>
            Name
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <fieldset>
            <legend>Permissions</legend>
            {PERMISSIONS.map((permission) => {
              const ownedByCaller = ownPermissions.has(permission);
              return (
                <label
                  key={permission}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', maxWidth: 'none' }}
                  title={ownedByCaller ? undefined : "You don't hold this permission yourself"}
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.has(permission)}
                    onChange={() => togglePermission(permission)}
                    disabled={!ownedByCaller}
                  />
                  {PERMISSION_LABELS[permission]}
                  {!ownedByCaller && ' (you do not hold this)'}
                </label>
              );
            })}
          </fieldset>
          <button type="submit" disabled={createMutation.isPending || !name}>
            {createMutation.isPending ? 'Creating…' : 'Create group'}
          </button>
        </form>
      </fieldset>

      <fieldset disabled={!canManage}>
        <legend>Assign a person to a group</legend>
        {!canManage && <PermissionHint permission="manage_users" />}
        <form onSubmit={handleAssignSubmit}>
          {assignMutation.isError && <ErrorBanner message={errorMessage(assignMutation.error)} />}
          {assignMutation.isSuccess && <p>Assigned.</p>}
          <label>
            Group
            <select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
              <option value="" disabled>
                Select a group
              </option>
              {groups?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <PersonIdField label="Person" value={personId} onChange={setPersonId} required />
          <button type="submit" disabled={assignMutation.isPending || !groupId || !personId}>
            {assignMutation.isPending ? 'Assigning…' : 'Assign'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
