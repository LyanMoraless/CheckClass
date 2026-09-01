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
      <h1>Grupos de permissões</h1>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {groups && (
        <DataTable<PermissionGroup>
          rows={groups}
          getRowKey={(group) => group.id}
          columns={[
            { header: 'Nome', cell: (group) => group.name },
            { header: 'Permissões', cell: (group) => group.permissions.map((p) => PERMISSION_LABELS[p]).join(', ') },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Novo grupo de permissões</legend>
        {!canManage && <PermissionHint permission="manage_users" />}
        <p>
          <small>O servidor limita isto às permissões que você já possui (sem autoescalação).</small>
        </p>
        <form onSubmit={handleCreateSubmit}>
          {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
          <label>
            Nome
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <fieldset>
            <legend>Permissões</legend>
            {PERMISSIONS.map((permission) => {
              const ownedByCaller = ownPermissions.has(permission);
              return (
                <label
                  key={permission}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', maxWidth: 'none' }}
                  title={ownedByCaller ? undefined : 'Você mesmo não possui esta permissão'}
                >
                  <input
                    type="checkbox"
                    checked={selectedPermissions.has(permission)}
                    onChange={() => togglePermission(permission)}
                    disabled={!ownedByCaller}
                  />
                  {PERMISSION_LABELS[permission]}
                  {!ownedByCaller && ' (você não possui esta permissão)'}
                </label>
              );
            })}
          </fieldset>
          <button type="submit" disabled={createMutation.isPending || !name}>
            {createMutation.isPending ? 'Criando…' : 'Criar grupo'}
          </button>
        </form>
      </fieldset>

      <fieldset disabled={!canManage}>
        <legend>Atribuir pessoa a um grupo</legend>
        {!canManage && <PermissionHint permission="manage_users" />}
        <form onSubmit={handleAssignSubmit}>
          {assignMutation.isError && <ErrorBanner message={errorMessage(assignMutation.error)} />}
          {assignMutation.isSuccess && <p>Atribuído.</p>}
          <label>
            Grupo
            <select value={groupId} onChange={(event) => setGroupId(event.target.value)} required>
              <option value="" disabled>
                Selecione um grupo
              </option>
              {groups?.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>
          <PersonIdField label="Pessoa" value={personId} onChange={setPersonId} required />
          <button type="submit" disabled={assignMutation.isPending || !groupId || !personId}>
            {assignMutation.isPending ? 'Atribuindo…' : 'Atribuir'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
