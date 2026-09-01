import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { PersonIdField } from '../../components/person-id-field';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import {
  createWristbandCategory,
  issueWristband,
  listWristbandCategories,
  listWristbandsByPerson,
  revokeWristband,
  type Wristband,
  type WristbandCategory,
} from './wristbands-api';

export function WristbandsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_users');
  const queryClient = useQueryClient();

  const { data: categories, isLoading: categoriesLoading, error: categoriesError } = useQuery({
    queryKey: ['wristband-categories'],
    queryFn: listWristbandCategories,
  });

  const [categoryName, setCategoryName] = useState('');
  const categoryMutation = useMutation({
    mutationFn: createWristbandCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wristband-categories'] });
      setCategoryName('');
    },
  });

  async function handleCategorySubmit(event: FormEvent) {
    event.preventDefault();
    categoryMutation.mutate(categoryName);
  }

  const [issuePersonId, setIssuePersonId] = useState('');
  const [wristbandCategoryId, setWristbandCategoryId] = useState('');
  const [tagCode, setTagCode] = useState('');
  const issueMutation = useMutation({
    mutationFn: issueWristband,
    onSuccess: () => {
      setTagCode('');
      if (lookupPersonId === issuePersonId) {
        queryClient.invalidateQueries({ queryKey: ['wristbands', issuePersonId] });
      }
    },
  });

  async function handleIssueSubmit(event: FormEvent) {
    event.preventDefault();
    issueMutation.mutate({ personId: issuePersonId, wristbandCategoryId, tagCode });
  }

  const [lookupPersonId, setLookupPersonId] = useState('');
  const [submittedLookupId, setSubmittedLookupId] = useState<string | null>(null);
  const {
    data: wristbands,
    isFetching: wristbandsFetching,
    error: wristbandsError,
  } = useQuery({
    queryKey: ['wristbands', submittedLookupId],
    queryFn: () => listWristbandsByPerson(submittedLookupId!),
    enabled: Boolean(submittedLookupId),
  });

  const revokeMutation = useMutation({
    mutationFn: revokeWristband,
    onSuccess: () => {
      if (submittedLookupId) {
        queryClient.invalidateQueries({ queryKey: ['wristbands', submittedLookupId] });
      }
    },
  });

  function categoryLabelFor(id: string): string {
    return categories?.find((category) => category.id === id)?.name ?? id;
  }

  function handleLookupSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmittedLookupId(lookupPersonId);
  }

  return (
    <section>
      <h1>Pulseiras</h1>

      <fieldset disabled={!canManage}>
        <legend>Categorias</legend>
        {!canManage && <PermissionHint permission="manage_users" />}
        {categoriesLoading && <Loading />}
        {categoriesError && <ErrorBanner message={errorMessage(categoriesError)} />}
        {categories && (
          <DataTable<WristbandCategory>
            rows={categories}
            getRowKey={(category) => category.id}
            columns={[{ header: 'Nome', cell: (category) => category.name }]}
          />
        )}
        <form onSubmit={handleCategorySubmit}>
          {categoryMutation.isError && <ErrorBanner message={errorMessage(categoryMutation.error)} />}
          <label>
            Nome da nova categoria
            <input type="text" value={categoryName} onChange={(event) => setCategoryName(event.target.value)} required />
          </label>
          <button type="submit" disabled={categoryMutation.isPending}>
            {categoryMutation.isPending ? 'Criando…' : 'Criar categoria'}
          </button>
        </form>
      </fieldset>

      <fieldset disabled={!canManage}>
        <legend>Emitir pulseira</legend>
        {!canManage && <PermissionHint permission="manage_users" />}
        <form onSubmit={handleIssueSubmit}>
          {issueMutation.isError && <ErrorBanner message={errorMessage(issueMutation.error)} />}
          {issueMutation.isSuccess && <p>Pulseira emitida.</p>}
          <PersonIdField label="Pessoa" value={issuePersonId} onChange={setIssuePersonId} required />
          <label>
            Categoria
            <select value={wristbandCategoryId} onChange={(event) => setWristbandCategoryId(event.target.value)} required>
              <option value="" disabled>
                Selecione uma categoria
              </option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Código da tag
            <input type="text" value={tagCode} onChange={(event) => setTagCode(event.target.value)} required />
          </label>
          <button type="submit" disabled={issueMutation.isPending || !issuePersonId || !wristbandCategoryId}>
            {issueMutation.isPending ? 'Emitindo…' : 'Emitir pulseira'}
          </button>
        </form>
      </fieldset>

      <div>
        <h2>Consultar pulseiras por pessoa</h2>
        <form onSubmit={handleLookupSubmit}>
          <PersonIdField label="Pessoa" value={lookupPersonId} onChange={setLookupPersonId} required />
          <button type="submit">Consultar</button>
        </form>
        {wristbandsFetching && <Loading />}
        {wristbandsError && <ErrorBanner message={errorMessage(wristbandsError)} />}
        {revokeMutation.isError && <ErrorBanner message={errorMessage(revokeMutation.error)} />}
        {wristbands && (
          <DataTable<Wristband>
            rows={wristbands}
            getRowKey={(wristband) => wristband.id}
            emptyMessage="Nenhuma pulseira encontrada para esta pessoa."
            columns={[
              { header: 'Código da tag', cell: (wristband) => wristband.tagCode },
              { header: 'Categoria', cell: (wristband) => categoryLabelFor(wristband.wristbandCategoryId) },
              { header: 'Status', cell: (wristband) => wristband.status },
              {
                header: 'Ações',
                cell: (wristband) =>
                  wristband.status === 'active' ? (
                    <button
                      type="button"
                      disabled={!canManage || revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(wristband.id)}
                    >
                      Revogar
                    </button>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        )}
      </div>
    </section>
  );
}
