import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listAreas, type Area } from '../areas/areas-api';
import { listCameras, registerCamera, type Camera } from './cameras-api';

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
      <h1>Cameras</h1>

      {!canView && <PermissionHint permission={[...VIEW_PERMISSIONS]} />}
      {canView && isLoading && <Loading />}
      {canView && error && <ErrorBanner message={errorMessage(error)} />}
      {canView && cameras && (
        <DataTable<Camera>
          rows={cameras}
          getRowKey={(camera) => camera.id}
          columns={[
            { header: 'Name', cell: (camera) => camera.name },
            {
              header: 'Area',
              cell: (camera) => {
                const area = areasById.get(camera.areaId);
                return area ? areaLabel(area, areasById) : <code>{camera.areaId}</code>;
              },
            },
            { header: 'Status', cell: (camera) => camera.status },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Register a camera</legend>
        {!canManage && <PermissionHint permission="administer_camera_devices" />}
        <p>
          <small>
            Metadata only: no camera protocol/stream is opened by the backend, this only records name/area/URL.
          </small>
        </p>
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Name
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          {areas && areas.length > 0 ? (
            <label>
              Area
              <select value={areaId} onChange={(event) => setAreaId(event.target.value)} required>
                <option value="" disabled>
                  Select an area
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
              Area ID
              <input
                type="text"
                value={areaId}
                onChange={(event) => setAreaId(event.target.value)}
                required
                placeholder="Area ID (UUID)"
              />
              {areasUnavailable && (
                <small>No permission to look up areas — paste the target area's ID directly.</small>
              )}
            </label>
          )}
          <label>
            Stream URL
            <input
              type="text"
              value={streamUrl}
              onChange={(event) => setStreamUrl(event.target.value)}
              required
              placeholder="rtsp://…"
            />
          </label>
          <button type="submit" disabled={mutation.isPending || !name || !areaId || !streamUrl}>
            {mutation.isPending ? 'Registering…' : 'Register camera'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
