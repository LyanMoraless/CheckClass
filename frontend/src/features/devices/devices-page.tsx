import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listRooms } from '../rooms/rooms-api';
import { ApiKeyRevealModal } from './api-key-reveal-modal';
import { listDevices, registerDevice, revokeDevice, type Device, type RegisteredDevice } from './devices-api';
import styles from './devices-page.module.css';

// device.status only ever comes back as 'active' or 'inactive' (see
// DeviceService.revoke on the backend, which sets it to 'inactive' — there
// is no distinct "revoked" value) — the badge just gives that raw string a
// legible pt-BR label and color, it doesn't reinterpret it.
function statusBadge(status: string) {
  const isActive = status === 'active';
  return <Badge label={isActive ? 'Ativo' : 'Inativo'} tone={isActive ? 'success' : 'neutral'} />;
}

export function DevicesPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: listRooms });
  const { data: devices, isLoading, error } = useQuery({ queryKey: ['devices'], queryFn: listDevices });

  const [roomId, setRoomId] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [externalIdentifier, setExternalIdentifier] = useState('');
  const [revealedKey, setRevealedKey] = useState<RegisteredDevice | null>(null);

  const registerMutation = useMutation({
    mutationFn: registerDevice,
    // gcTime: 0 — the result carries the one-time device API key, so it
    // shouldn't linger in TanStack Query's mutation cache after settling.
    gcTime: 0,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['devices'] });
      setDeviceType('');
      setExternalIdentifier('');
      setRoomId('');
      setRevealedKey(result);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: revokeDevice,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['devices'] }),
  });

  function roomName(id: string | null): string {
    if (!id) return '—';
    return rooms?.find((room) => room.id === id)?.name ?? id;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    registerMutation.mutate({ roomId: roomId || undefined, deviceType, externalIdentifier });
  }

  return (
    <section>
      <PageHeader
        icon={Cpu}
        area="settings"
        title="Dispositivos"
        description="Registre leitores e outros dispositivos vinculados às salas e gerencie suas chaves de API."
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {devices && (
        <DataTable<Device>
          rows={devices}
          getRowKey={(device) => device.id}
          columns={[
            { header: 'Tipo', cell: (device) => device.deviceType },
            { header: 'Identificador externo', cell: (device) => device.externalIdentifier },
            { header: 'Sala', cell: (device) => roomName(device.roomId) },
            { header: 'Status', cell: (device) => statusBadge(device.status) },
            {
              header: 'Ações',
              cell: (device) =>
                device.status === 'active' ? (
                  <button
                    type="button"
                    className={`danger ${styles.iconButton}`}
                    disabled={!canManage || revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(device.id)}
                  >
                    <X size={16} />
                    Revogar
                  </button>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      )}
      {revokeMutation.isError && <ErrorBanner message={errorMessage(revokeMutation.error)} />}

      <fieldset disabled={!canManage}>
        <legend>Registrar dispositivo</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {registerMutation.isError && <ErrorBanner message={errorMessage(registerMutation.error)} />}
          <label>
            Tipo do dispositivo
            <input
              type="text"
              value={deviceType}
              onChange={(event) => setDeviceType(event.target.value)}
              required
              maxLength={50}
              placeholder="ex.: tag_reader, camera"
            />
          </label>
          <label>
            Identificador externo
            <input
              type="text"
              value={externalIdentifier}
              onChange={(event) => setExternalIdentifier(event.target.value)}
              required
              maxLength={255}
            />
          </label>
          <label>
            Sala (opcional)
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">Sem sala</option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={styles.iconButton} disabled={registerMutation.isPending}>
            <Plus size={16} />
            {registerMutation.isPending ? 'Registrando…' : 'Registrar dispositivo'}
          </button>
        </form>
      </fieldset>

      {revealedKey && (
        <ApiKeyRevealModal
          apiKey={revealedKey.apiKey}
          onConfirmed={() => {
            setRevealedKey(null);
            // Drops the mutation's own retained result (which still holds the
            // raw key) — gcTime alone only affects post-unmount cleanup.
            registerMutation.reset();
          }}
        />
      )}
    </section>
  );
}
