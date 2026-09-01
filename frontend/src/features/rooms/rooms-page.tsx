import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { createRoom, listRooms, type Room } from './rooms-api';

export function RoomsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();
  const { data: rooms, isLoading, error } = useQuery({ queryKey: ['rooms'], queryFn: listRooms });

  const [name, setName] = useState('');
  const mutation = useMutation({
    mutationFn: createRoom,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      setName('');
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ name });
  }

  return (
    <section>
      <h1>Salas</h1>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {rooms && (
        <DataTable<Room> rows={rooms} getRowKey={(room) => room.id} columns={[{ header: 'Nome', cell: (room) => room.name }]} />
      )}

      <fieldset disabled={!canManage}>
        <legend>Nova sala</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Nome
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Criando…' : 'Criar sala'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
