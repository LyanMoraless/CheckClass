import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Network, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { RoleHint } from '../../components/role-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { isPlausibleCidrShape } from './cidr-shape';
import {
  createInstitutionalNetworkRange,
  deleteInstitutionalNetworkRange,
  listInstitutionalNetworkRanges,
  updateInstitutionalNetworkRange,
  type InstitutionalNetworkRange,
  type InstitutionalNetworkRangeInput,
} from './institutional-network-ranges-api';
import styles from './institutional-network-ranges-page.module.css';

const QUERY_KEY = ['institutional-network-ranges'];

const EMPTY_FORM: InstitutionalNetworkRangeInput = { cidr: '', label: '' };

// GAP-10 (RULE-DEV-14): admin CRUD for the allowlist of IP/CIDR ranges this
// institution declares as "inside the institutional network" — used to
// gate the device-binding creation (Frente 12) and, later, the Frente 13
// facial-login decision. Read AND write are both Direção/Reitoria-only
// server-side (institutional-network-range.service.ts's
// assertDirectionAuthority runs on every method) — same LeadershipScopeService
// mechanism as institutional-machines-page.tsx (roleContext.isDirection, no
// dedicated Permission enum code, RULE-DEV-15/RULE-ACC-08), so this whole
// page is gated on it, not just the form, mirroring that same precedent.
export function InstitutionalNetworkRangesPage() {
  const { roleContext } = useAuth();
  const canManage = roleContext.isDirection;
  const queryClient = useQueryClient();

  const {
    data: ranges,
    isLoading,
    error,
  } = useQuery({ queryKey: QUERY_KEY, queryFn: listInstitutionalNetworkRanges, enabled: canManage });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstitutionalNetworkRangeInput>(EMPTY_FORM);

  function updateField<K extends keyof InstitutionalNetworkRangeInput>(key: K, value: InstitutionalNetworkRangeInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(range: InstitutionalNetworkRange) {
    setEditingId(range.id);
    setForm({ cidr: range.cidr, label: range.label ?? '' });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const saveMutation = useMutation({
    mutationFn: (input: InstitutionalNetworkRangeInput) =>
      editingId ? updateInstitutionalNetworkRange(editingId, input) : createInstitutionalNetworkRange(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      cancelEditing();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteInstitutionalNetworkRange,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const trimmedCidr = form.cidr.trim();
  // Empty-but-untouched (no red state yet) is distinct from
  // "typed-but-malformed" — required/maxLength already stop an empty
  // submit, so this only needs to react once there IS something to judge.
  const cidrShapeValid = trimmedCidr === '' || isPlausibleCidrShape(trimmedCidr);
  const canSubmit = trimmedCidr !== '' && cidrShapeValid;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const label = form.label?.trim();
    saveMutation.mutate({ cidr: trimmedCidr, label: label ? label : undefined });
  }

  return (
    <section>
      <PageHeader
        icon={Network}
        area="settings"
        title="Rede institucional"
        description="Faixas de IP/CIDR que esta instituição declara como 'dentro da rede institucional' (RULE-DEV-14) — usadas para liberar o vínculo de dispositivo. Sem nenhuma faixa cadastrada, todo acesso é tratado como fora da rede."
      />

      {!canManage && <RoleHint />}
      {canManage && isLoading && <Loading />}
      {canManage && error && <ErrorBanner message={errorMessage(error)} />}
      {canManage && deleteMutation.isError && <ErrorBanner message={errorMessage(deleteMutation.error)} />}
      {canManage && ranges && (
        <DataTable<InstitutionalNetworkRange>
          rows={ranges}
          getRowKey={(range) => range.id}
          emptyMessage="Nenhuma faixa cadastrada ainda — enquanto isso, todo acesso é tratado como fora da rede institucional."
          columns={[
            { header: 'CIDR', cell: (range) => range.cidr },
            { header: 'Rótulo', cell: (range) => range.label ?? '—' },
            {
              header: 'Ações',
              cell: (range) => (
                <div className={styles.actionsCell}>
                  <button type="button" className={`secondary ${styles.iconButton}`} onClick={() => startEditing(range)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    type="button"
                    className={`danger ${styles.iconButton}`}
                    disabled={deleteMutation.isPending && deleteMutation.variables === range.id}
                    onClick={() => deleteMutation.mutate(range.id)}
                  >
                    <Trash2 size={14} />
                    Remover
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {canManage && (
        <fieldset>
          <legend>{editingId ? 'Editar faixa' : 'Cadastrar faixa'}</legend>
          <form onSubmit={handleSubmit}>
            {saveMutation.isError && <ErrorBanner message={errorMessage(saveMutation.error)} />}
            <label>
              CIDR
              <input
                type="text"
                value={form.cidr}
                onChange={(event) => updateField('cidr', event.target.value)}
                required
                maxLength={43}
                placeholder="ex.: 203.0.113.0/24"
                aria-invalid={!cidrShapeValid}
              />
            </label>
            {!cidrShapeValid && (
              <small role="alert">Formato de CIDR inválido — use algo como 203.0.113.0/24 ou 2001:db8::/32.</small>
            )}
            <label>
              Rótulo (opcional)
              <input
                type="text"
                value={form.label ?? ''}
                onChange={(event) => updateField('label', event.target.value)}
                maxLength={255}
                placeholder="ex.: Prédio principal"
              />
            </label>
            <div className={styles.actionsCell}>
              <button type="submit" className={styles.iconButton} disabled={saveMutation.isPending || !canSubmit}>
                <Plus size={16} />
                {saveMutation.isPending ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar faixa'}
              </button>
              {editingId && (
                <button type="button" className={`secondary ${styles.iconButton}`} onClick={cancelEditing}>
                  <X size={16} />
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </fieldset>
      )}
    </section>
  );
}
