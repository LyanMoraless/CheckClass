import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { createArea, listAreas, type Area, type AreaInput } from './areas-api';
import styles from './areas-page.module.css';

const QUERY_KEY = ['areas'];

const EMPTY_FORM: AreaInput = { name: '', parentAreaId: undefined };

// "Bloco A > Andar 1" — same one-level-of-parent-context convention
// cameras-page.tsx's areaLabel() already established for referencing an
// area; reused here both for the table's "Bloco pai" column and for the
// parent <select>'s options.
function areaLabel(area: Area, areasById: Map<string, Area>): string {
  const parent = area.parentAreaId ? areasById.get(area.parentAreaId) : undefined;
  return parent ? `${parent.name} > ${area.name}` : area.name;
}

// Frente 08: institution self-service management of its own physical/
// organizational structure (bloco -> área/andar/corredor, area.service.ts's
// own header comment) — until now the only way to create an area row was
// seed/API direct, which meant every wristband_category_area_permission
// grant (RULE-ACC-02) and camera registration (cameras-page.tsx's area
// <select>) depended on rows nobody in the institution could actually
// create. Backend only exposes create+list (no update/delete route on
// AreaController yet), so this page mirrors exactly that: register new
// areas/blocos, no edit/remove — do not invent endpoints that don't exist.
// Gated on manage_institution_structure, the same permission already used
// for the rest of "Cadastro de informações" (Cursos/Matérias/Turmas/
// Coordenadores de curso).
export function AreasPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const {
    data: areas,
    isLoading,
    error,
  } = useQuery({ queryKey: QUERY_KEY, queryFn: listAreas, enabled: canManage });
  const areasById = new Map((areas ?? []).map((area) => [area.id, area]));

  const [form, setForm] = useState<AreaInput>(EMPTY_FORM);

  function updateField<K extends keyof AreaInput>(key: K, value: AreaInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const createMutation = useMutation({
    mutationFn: (input: AreaInput) => createArea(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setForm(EMPTY_FORM);
    },
  });

  const trimmedName = form.name.trim();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!trimmedName) {
      return;
    }
    createMutation.mutate({ name: trimmedName, parentAreaId: form.parentAreaId || undefined });
  }

  return (
    <section>
      <PageHeader
        icon={Building2}
        area="registry"
        title="Áreas / blocos"
        description="Estrutura física e organizacional da instituição (bloco, área, andar, corredor) — usada para localizar câmeras e restringir o acesso de pulseiras por área."
      />

      {!canManage && <PermissionHint permission="manage_institution_structure" />}
      {canManage && isLoading && <Loading />}
      {canManage && error && <ErrorBanner message={errorMessage(error)} />}
      {canManage && areas && (
        <DataTable<Area>
          rows={areas}
          getRowKey={(area) => area.id}
          emptyMessage="Nenhuma área cadastrada ainda."
          columns={[
            { header: 'Nome', cell: (area) => area.name },
            {
              header: 'Bloco/área pai',
              cell: (area) => (area.parentAreaId ? (areasById.get(area.parentAreaId)?.name ?? area.parentAreaId) : '—'),
            },
          ]}
        />
      )}

      {canManage && (
        <fieldset>
          <legend>Cadastrar área</legend>
          <form onSubmit={handleSubmit}>
            {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
            <label>
              Nome
              <input
                type="text"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
                maxLength={255}
                placeholder="ex.: Bloco A, Andar 1, Corredor Leste"
              />
            </label>
            <label>
              Bloco/área pai (opcional)
              <select
                value={form.parentAreaId ?? ''}
                onChange={(event) => updateField('parentAreaId', event.target.value || undefined)}
              >
                <option value="">Nenhum (nível superior)</option>
                {areas?.map((area) => (
                  <option key={area.id} value={area.id}>
                    {areaLabel(area, areasById)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={styles.iconButton} disabled={createMutation.isPending || !trimmedName}>
              <Plus size={16} />
              {createMutation.isPending ? 'Cadastrando…' : 'Cadastrar área'}
            </button>
          </form>
        </fieldset>
      )}
    </section>
  );
}
