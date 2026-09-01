import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Info, Video } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listAreas, type Area } from '../areas/areas-api';
import { listCameras, registerCamera, type Camera } from './cameras-api';
import styles from './cameras-page.module.css';

// "Bloco A > Andar 1" — one level of parent context is enough to
// disambiguate same-named areas in different blocos without building a
// full breadcrumb for what's still a flat self-referencing hierarchy.
function areaLabel(area: Area, areasById: Map<string, Area>): string {
  const parent = area.parentAreaId ? areasById.get(area.parentAreaId) : undefined;
  return parent ? `${parent.name} > ${area.name}` : area.name;
}

const VIEW_PERMISSIONS = ['view_camera', 'view_sector_cameras'] as const;

export function CamerasPage() {
  const { hasPermission } = useAuth();
  // Backend gates GET /v1/cameras with @RequirePermission(VIEW_CAMERA,
  // VIEW_SECTOR_CAMERAS) — OR semantics (RULE-ACC-07's six codes are
  // independent, so either is enough to see the inventory).
  const canView = VIEW_PERMISSIONS.some((permission) => hasPermission(permission));
  const canManage = hasPermission('administer_camera_devices');
  const queryClient = useQueryClient();

  const { data: cameras, isLoading, error } = useQuery({
    queryKey: ['cameras'],
    queryFn: listCameras,
    enabled: canView,
  });

  // GET /v1/areas is gated by manage_institution_structure, a different
  // permission from administer_camera_devices — a caller who can manage
  // cameras but not institution structure will 403 here. Degrade to a
  // manual-UUID-paste fallback in that case rather than blocking the form,
  // same pattern already used elsewhere in this app for cross-permission
  // lookup gaps.
  const { data: areas, isError: areasUnavailable } = useQuery({
    queryKey: ['areas'],
    queryFn: listAreas,
    enabled: canManage,
    retry: false,
  });
  const areasById = new Map((areas ?? []).map((area) => [area.id, area]));

  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const mutation = useMutation({
    mutationFn: registerCamera,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cameras'] });
      setName('');
      setAreaId('');
      setStreamUrl('');
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ name, areaId, streamUrl });
  }

  return (
    <section>
      <PageHeader
        icon={Video}
        area="security"
        title="Câmeras"
        description="Inventário de câmeras de segurança e a área de cobertura de cada uma."
      />

      {!canView && <PermissionHint permission={[...VIEW_PERMISSIONS]} />}
      {canView && isLoading && <Loading />}
      {canView && error && <ErrorBanner message={errorMessage(error)} />}
      {canView && cameras && (
        <div className={styles.tableSection}>
          <DataTable<Camera>
            rows={cameras}
            getRowKey={(camera) => camera.id}
            columns={[
              { header: 'Nome', cell: (camera) => camera.name },
              {
                header: 'Área',
                cell: (camera) => {
                  const area = areasById.get(camera.areaId);
                  return area ? areaLabel(area, areasById) : <code>{camera.areaId}</code>;
                },
              },
              {
                header: 'Status',
                cell: (camera) => (
                  <Badge
                    label={camera.status === 'active' ? 'Ativa' : camera.status}
                    tone={camera.status === 'active' ? 'success' : 'neutral'}
                  />
                ),
              },
            ]}
          />
        </div>
      )}

      <fieldset disabled={!canManage}>
        <legend>Registrar câmera</legend>
        {!canManage && <PermissionHint permission="administer_camera_devices" />}
        <p className={styles.note}>
          <Info size={14} />
          Apenas metadados: nenhum protocolo/transmissão de câmera é aberto pelo backend, isto apenas registra
          nome/área/URL.
        </p>
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Nome
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          {areas && areas.length > 0 ? (
            <label>
              Área
              <select value={areaId} onChange={(event) => setAreaId(event.target.value)} required>
                <option value="" disabled>
                  Selecione uma área
                </option>
                {areas.map((area) => (
                  <option key={area.id} value={area.id}>
                    {areaLabel(area, areasById)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              ID da área
              <input
                type="text"
                value={areaId}
                onChange={(event) => setAreaId(event.target.value)}
                required
                placeholder="ID da área (UUID)"
              />
              {areasUnavailable && (
                <small>Sem permissão para consultar áreas — cole diretamente o ID da área desejada.</small>
              )}
            </label>
          )}
          <label>
            URL da transmissão
            <input
              type="text"
              value={streamUrl}
              onChange={(event) => setStreamUrl(event.target.value)}
              required
              placeholder="rtsp://…"
            />
          </label>
          <button type="submit" disabled={mutation.isPending || !name || !areaId || !streamUrl}>
            {mutation.isPending ? 'Registrando…' : 'Registrar câmera'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
