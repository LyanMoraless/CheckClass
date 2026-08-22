import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listRooms } from '../rooms/rooms-api';
import { ApiKeyRevealModal } from './api-key-reveal-modal';
import { listDevices, registerDevice, revokeDevice, type Device, type RegisteredDevice } from './devices-api';

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
      <h1>Devices</h1>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {devices && (
        <DataTable<Device>
          rows={devices}
          getRowKey={(device) => device.id}
          columns={[
            { header: 'Type', cell: (device) => device.deviceType },
            { header: 'External identifier', cell: (device) => device.externalIdentifier },
            { header: 'Room', cell: (device) => roomName(device.roomId) },
            { header: 'Status', cell: (device) => device.status },
            {
              header: 'Actions',
              cell: (device) =>
                device.status === 'active' ? (
                  <button
                    type="button"
                    disabled={!canManage || revokeMutation.isPending}
                    onClick={() => revokeMutation.mutate(device.id)}
                  >
                    Revoke
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
        <legend>Register a device</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleSubmit}>
          {registerMutation.isError && <ErrorBanner message={errorMessage(registerMutation.error)} />}
          <label>
            Device type
            <input
              type="text"
              value={deviceType}
              onChange={(event) => setDeviceType(event.target.value)}
              required
              maxLength={50}
              placeholder="e.g. tag_reader, camera"
            />
          </label>
          <label>
            External identifier
            <input
              type="text"
              value={externalIdentifier}
              onChange={(event) => setExternalIdentifier(event.target.value)}
              required
              maxLength={255}
            />
          </label>
          <label>
            Room (optional)
            <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
              <option value="">No room</option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={registerMutation.isPending}>
            {registerMutation.isPending ? 'Registering…' : 'Register device'}
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
