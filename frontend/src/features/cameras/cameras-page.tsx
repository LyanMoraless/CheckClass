import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listCameras, registerCamera, type Camera } from './cameras-api';

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
            { header: 'Area ID', cell: (camera) => <code>{camera.areaId}</code> },
            { header: 'Status', cell: (camera) => camera.status },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Register a camera</legend>
        {!canManage && <PermissionHint permission="administer_camera_devices" />}
        <p>
          <small>
            No area lookup is available yet — paste the target area's ID directly. Metadata only: no camera
            protocol/stream is opened by the backend, this only records name/area/URL.
          </small>
        </p>
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          <label>
            Name
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} required maxLength={255} />
          </label>
          <label>
            Area ID
            <input
              type="text"
              value={areaId}
              onChange={(event) => setAreaId(event.target.value)}
              required
              placeholder="Area ID (UUID)"
            />
          </label>
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
