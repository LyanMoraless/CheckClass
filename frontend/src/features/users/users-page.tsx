import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { createPerson, listPersons, type Person } from './users-api';

export function UsersPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_users');
  const queryClient = useQueryClient();
  const { data: persons, isLoading, error } = useQuery({ queryKey: ['persons'], queryFn: listPersons });

  const [fullName, setFullName] = useState('');
  const [actorTypeCode, setActorTypeCode] = useState('');
  const [withLogin, setWithLogin] = useState(false);
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createPerson,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['persons'] });
      setFullName('');
      setActorTypeCode('');
      setCpf('');
      setPassword('');
      setWithLogin(false);
      setCreatedId(result.personId);
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({
      fullName,
      actorTypeCode,
      cpf: withLogin ? cpf : undefined,
      password: withLogin ? password : undefined,
    });
  }

  return (
    <section>
      <h1>Users</h1>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {persons && (
        <DataTable<Person>
          rows={persons}
          getRowKey={(person) => person.personId}
          columns={[
            { header: 'Full name', cell: (person) => person.fullName },
            { header: 'Actor type', cell: (person) => person.actorTypeCode },
            { header: 'Has login', cell: (person) => (person.hasLoginCredential ? 'Yes' : 'No') },
            { header: 'ID', cell: (person) => <code>{person.personId}</code> },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>New person</legend>
        {!canManage && <PermissionHint permission="manage_users" />}
        {createdId && (
          <p>
            Created person <code>{createdId}</code> — copy this ID to use in enrollment, wristband, or permission-group
            screens if the lookup list above isn't available to you.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Full name
            <input type="text" value={fullName} onChange={(event) => setFullName(event.target.value)} required />
          </label>
          <label>
            Actor type code
            <input
              type="text"
              value={actorTypeCode}
              onChange={(event) => setActorTypeCode(event.target.value)}
              required
              placeholder="e.g. STUDENT, TEACHER"
            />
          </label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', maxWidth: 'none' }}>
            <input type="checkbox" checked={withLogin} onChange={(event) => setWithLogin(event.target.checked)} />
            Create login credentials for this person
          </label>
          {withLogin && (
            <>
              <label>
                CPF (11 digits)
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  value={cpf}
                  onChange={(event) => setCpf(event.target.value.replace(/\D/g, ''))}
                  required
                />
              </label>
              <label>
                Password
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
              </label>
            </>
          )}
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create person'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
