import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import type { ClassGroup } from '../class-groups/class-groups-api';
import { createScheduleSlot, deleteScheduleSlot, generateSessions, listScheduleSlots, type ScheduleSlot } from './class-schedule-api';

// JS Date.getDay() convention (0 = domingo .. 6 = sábado), matching the
// backend's dayOfWeek — same convention documented on the entity/DTO.
const DAY_OF_WEEK_LABELS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function formatTime(value: string): string {
  return value.slice(0, 5);
}

interface ScheduleSlotsSectionProps {
  classGroupId: string;
  classGroup: ClassGroup | undefined;
}

// RULE-INST-04/07/10: manages the recurring weekly grade a turma's sessions
// get generated from, plus the "Gerar sessões" action itself. Adding/removing
// a slot regenerates future untouched sessions automatically server-side
// (ScheduleRegenerationService) — this component only needs to trigger the
// slot CRUD and refresh the sessions list, not implement that regeneration.
export function ScheduleSlotsSection({ classGroupId, classGroup }: ScheduleSlotsSectionProps) {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_institution_structure');
  const queryClient = useQueryClient();

  const {
    data: slots,
    isLoading,
    error,
  } = useQuery({ queryKey: ['schedule-slots', classGroupId], queryFn: () => listScheduleSlots(classGroupId) });

  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const createMutation = useMutation({
    mutationFn: () => createScheduleSlot(classGroupId, { dayOfWeek: Number(dayOfWeek), startTime, endTime }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-slots', classGroupId] });
      // A slot create/delete regenerates future sessions server-side —
      // refresh the sessions list too so the effect is visible immediately.
      queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] });
      setStartTime('');
      setEndTime('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (slotId: string) => deleteScheduleSlot(classGroupId, slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-slots', classGroupId] });
      queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] });
    },
  });

  const generateMutation = useMutation({
    mutationFn: () => generateSessions(classGroupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['class-sessions', classGroupId] }),
  });

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    createMutation.mutate();
  }

  // Advisory only — the backend is the source of truth and returns a 400
  // (shown via ErrorBanner below) if either is actually missing when
  // "Gerar sessões" is pressed. This hint just saves a failed round-trip in
  // the common case.
  const missingPrerequisites: string[] = [];
  if (classGroup && !classGroup.roomId) {
    missingPrerequisites.push('sala');
  }
  if (classGroup && (!classGroup.termStartDate || !classGroup.termEndDate)) {
    missingPrerequisites.push('período letivo (início e fim)');
  }

  return (
    <div>
      <h2>Grade recorrente</h2>
      <p>
        <small>
          Cada slot é um dia da semana + horário que se repete durante todo o período letivo da turma. Adicionar ou
          remover um slot regenera automaticamente as aulas futuras ainda não tocadas — aulas passadas e aulas já
          editadas/canceladas pontualmente não são afetadas.
        </small>
      </p>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {deleteMutation.isError && <ErrorBanner message={errorMessage(deleteMutation.error)} />}
      {slots && (
        <DataTable<ScheduleSlot>
          rows={slots}
          getRowKey={(slot) => slot.id}
          emptyMessage="Nenhum slot na grade ainda."
          columns={[
            { header: 'Dia da semana', cell: (slot) => DAY_OF_WEEK_LABELS[slot.dayOfWeek] },
            { header: 'Início', cell: (slot) => formatTime(slot.startTime) },
            { header: 'Fim', cell: (slot) => formatTime(slot.endTime) },
            {
              header: 'Ações',
              cell: (slot) => (
                <button
                  type="button"
                  disabled={!canManage || deleteMutation.isPending}
                  onClick={() => deleteMutation.mutate(slot.id)}
                >
                  Remover
                </button>
              ),
            },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Novo slot</legend>
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        <form onSubmit={handleCreateSubmit}>
          {createMutation.isError && <ErrorBanner message={errorMessage(createMutation.error)} />}
          <label>
            Dia da semana
            <select value={dayOfWeek} onChange={(event) => setDayOfWeek(event.target.value)}>
              {DAY_OF_WEEK_LABELS.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Início
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
          </label>
          <label>
            Fim
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
          </label>
          <button type="submit" disabled={createMutation.isPending || !startTime || !endTime}>
            {createMutation.isPending ? 'Adicionando…' : 'Adicionar slot'}
          </button>
        </form>
      </fieldset>

      <div>
        <h3>Gerar aulas a partir da grade</h3>
        {missingPrerequisites.length > 0 && (
          <p>
            <small>Defina {missingPrerequisites.join(' e ')} da turma antes de gerar as aulas.</small>
          </p>
        )}
        {!canManage && <PermissionHint permission="manage_institution_structure" />}
        {generateMutation.isError && <ErrorBanner message={errorMessage(generateMutation.error)} />}
        {generateMutation.isSuccess && generateMutation.data && (
          <InfoBanner
            message={`Aulas geradas: ${generateMutation.data.created} criada(s), ${generateMutation.data.skipped} já existente(s) ignorada(s).`}
          />
        )}
        <button
          type="button"
          disabled={!canManage || generateMutation.isPending || !slots || slots.length === 0}
          onClick={() => generateMutation.mutate()}
        >
          {generateMutation.isPending ? 'Gerando…' : 'Gerar sessões'}
        </button>
      </div>
    </div>
  );
}
