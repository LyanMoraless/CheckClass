import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarClock, Check, Pencil, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge, type BadgeTone } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import type { Room } from '../rooms/rooms-api';
import {
  cancelClassSession,
  createClassSession,
  editClassSession,
  listClassSessions,
  type ClassSession,
  type ClassSessionStatus,
} from './class-schedule-api';
import styles from './class-sessions-section.module.css';

const STATUS_LABELS: Record<ClassSessionStatus, string> = {
  scheduled: 'Programada',
  edited: 'Editada pontualmente',
  cancelled: 'Cancelada',
};

// Visual tone only — the three statuses and their labels above are
// unchanged. scheduled = untouched/on-track (info), edited = a pontual
// change worth noticing (warning), cancelled = no longer happening (danger).
const STATUS_TONES: Record<ClassSessionStatus, BadgeTone> = {
  scheduled: 'info',
  edited: 'warning',
  cancelled: 'danger',
};

// "YYYY-MM-DDTHH:mm" (local time) <-> ISO conversion for <input type="datetime-local">.
function toDatetimeLocalValue(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

interface ClassSessionsSectionProps {
  classGroupId: string;
  rooms: Room[] | undefined;
  // RULE-INST-06/07: needed to show which room a session with roomId = null
  // is actually inheriting, directly on this operational screen.
  classGroupRoomId: string | null | undefined;
}

// RULE-INST-04 (third-round update): shows every generated session
// (date/horário/sala/status) with pontual cancel/edit actions, plus the
// pre-existing ad-hoc "Nova aula" manual creation — kept because the backend
// still supports it as a separate, always-available creation path alongside
// bulk generation from the grade above (see class-session.service.ts).
export function ClassSessionsSection({ classGroupId, rooms, classGroupRoomId }: ClassSessionsSectionProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const {
    data: sessions,
    isLoading,
    error,
  } = useQuery({ queryKey: ['class-sessions', classGroupId], queryFn: () => listClassSessions(classGroupId) });

  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editRoomId, setEditRoomId] = useState('');

  const editMutation = useMutation({
    mutationFn: (sessionId: string) =>
      editClassSession(sessionId, {
        scheduledStart: new Date(editStart).toISOString(),
        scheduledEnd: new Date(editEnd).toISOString(),
        roomId: editRoomId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] });
      setEditingSessionId(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (sessionId: string) => cancelClassSession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] }),
  });

  const [manualRoomId, setManualRoomId] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');
  const createMutation = useMutation({
    mutationFn: () =>
      createClassSession({
        classGroupId,
        roomId: manualRoomId || undefined,
        scheduledStart: new Date(manualStart).toISOString(),
        scheduledEnd: new Date(manualEnd).toISOString(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] });
      setManualStart('');
      setManualEnd('');
    },
  });

  function roomName(id: string | null): string {
    const effectiveId = id ?? classGroupRoomId;
    if (!effectiveId) {
      return '—';
    }
    return rooms?.find((room) => room.id === effectiveId)?.name ?? effectiveId;
  }

  function startEditing(session: ClassSession) {
    setEditingSessionId(session.id);
    setEditStart(toDatetimeLocalValue(session.scheduledStart));
    setEditEnd(toDatetimeLocalValue(session.scheduledEnd));
    setEditRoomId(session.roomId ?? '');
  }

  async function handleManualSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <CalendarClock size={18} />
        <h2>Aulas geradas</h2>
      </div>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {cancelMutation.isError && <ErrorBanner message={errorMessage(cancelMutation.error)} />}
      {editMutation.isError && <ErrorBanner message={errorMessage(editMutation.error)} />}
      {!canManage && <PermissionHint permission="manage_institution_structure" />}
      {sessions && (
        <DataTable<ClassSession>
          rows={sessions}
          getRowKey={(session) => session.id}
          emptyMessage="Nenhuma aula gerada ainda para esta turma."
          columns={[
            {
              header: 'Início',
              cell: (session) =>
                editingSessionId === session.id ? (
                  <input
                    type="datetime-local"
                    value={editStart}
                    onChange={(event) => setEditStart(event.target.value)}
                    required
                  />
                ) : (
                  new Date(session.scheduledStart).toLocaleString()
                ),
            },
            {
              header: 'Fim',
              cell: (session) =>
                editingSessionId === session.id ? (
                  <input type="datetime-local" value={editEnd} onChange={(event) => setEditEnd(event.target.value)} required />
                ) : (
                  new Date(session.scheduledEnd).toLocaleString()
                ),
            },
            {
              header: 'Sala',
              cell: (session) =>
                editingSessionId === session.id ? (
                  <select value={editRoomId} onChange={(event) => setEditRoomId(event.target.value)}>
                    <option value="">Herdar sala da turma</option>
                    {rooms?.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  roomName(session.roomId)
                ),
            },
            {
              header: 'Status',
              cell: (session) => <Badge label={STATUS_LABELS[session.status]} tone={STATUS_TONES[session.status]} />,
            },
            {
              header: 'Ações',
              cell: (session) => {
                if (session.status === 'cancelled') {
                  return '—';
                }
                if (editingSessionId === session.id) {
                  return (
                    <div className={styles.actionsCell}>
                      <button
                        type="button"
                        className={styles.iconButton}
                        disabled={editMutation.isPending || !editStart || !editEnd}
                        onClick={() => editMutation.mutate(session.id)}
                      >
                        <Check size={14} />
                        {editMutation.isPending ? 'Salvando…' : 'Salvar'}
                      </button>
                      <button
                        type="button"
                        className={`secondary ${styles.iconButton}`}
                        onClick={() => setEditingSessionId(null)}
                      >
                        <X size={14} />
                        Cancelar edição
                      </button>
                    </div>
                  );
                }
                return (
                  <div className={styles.actionsCell}>
                    <button
                      type="button"
                      className={`secondary ${styles.iconButton}`}
                      disabled={!canManage}
                      onClick={() => startEditing(session)}
                    >
                      <Pencil size={14} />
                      Editar
                    </button>
                    <button
                      type="button"
                      className={`danger ${styles.iconButton}`}
                      disabled={!canManage || cancelMutation.isPending}
                      onClick={() => cancelMutation.mutate(session.id)}
                    >
                      <Ban size={14} />
                      Cancelar aula
                    </button>
                  </div>
                );
              },
            },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Nova aula avulsa</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <p className={styles.description}>
          <small>Cria uma sessão isolada, fora da grade recorrente — útil para uma reposição pontual.</small>
        </p>
        <form onSubmit={handleManualSubmit}>
          {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
          <label>
            Sala (opcional, herda a sala da turma se vazio)
            <select value={manualRoomId} onChange={(event) => setManualRoomId(event.target.value)}>
              <option value="">Herdar sala da turma</option>
              {rooms?.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início programado
            <input type="datetime-local" value={manualStart} onChange={(event) => setManualStart(event.target.value)} required />
          </label>
          <label>
            Fim programado
            <input type="datetime-local" value={manualEnd} onChange={(event) => setManualEnd(event.target.value)} required />
          </label>
          <button
            type="submit"
            disabled={createMutation.isPending || !manualStart || !manualEnd}
            className={styles.iconButton}
          >
            <Plus size={16} />
            {createMutation.isPending ? 'Criando…' : 'Criar aula avulsa'}
          </button>
        </form>
      </fieldset>
    </div>
  );
}
