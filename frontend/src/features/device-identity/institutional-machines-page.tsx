import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Monitor, Pencil, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Badge, type BadgeTone } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { RoleHint } from '../../components/role-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listCourses } from '../courses/courses-api';
import { listRooms } from '../rooms/rooms-api';
import { enrollDeviceCredential } from './device-credential-api';
import {
  createInstitutionalMachine,
  listInstitutionalMachines,
  updateInstitutionalMachine,
  type InstitutionalMachine,
  type InstitutionalMachineInput,
  type InstitutionalMachineStatus,
} from './institutional-machines-api';
import styles from './institutional-machines-page.module.css';

const STATUS_OPTIONS: InstitutionalMachineStatus[] = ['active', 'maintenance', 'decommissioned', 'stolen'];

const STATUS_LABELS: Record<InstitutionalMachineStatus, string> = {
  active: 'Ativa',
  maintenance: 'Manutenção',
  decommissioned: 'Baixada',
  stolen: 'Roubada',
};

const STATUS_TONES: Record<InstitutionalMachineStatus, BadgeTone> = {
  active: 'success',
  maintenance: 'warning',
  decommissioned: 'neutral',
  stolen: 'danger',
};

const EMPTY_FORM: InstitutionalMachineInput = {
  assetTag: '',
  serialNumber: '',
  roomId: '',
  status: 'active',
  brand: '',
  model: '',
  processor: '',
  memoryDescription: '',
  operatingSystem: '',
  courseId: '',
};

// RULE-DEV-15: cadastrar/editar/dar baixa (and, per
// institutional-machine.service.ts's own "default to denying access" note,
// list/get too) is Direção/Reitoria-only — checked server-side via
// LeadershipScopeService, NOT a Permission enum code (RULE-ACC-08 confirms
// there is deliberately none). roleContext.isDirection is the same signal
// (MeContextService.isDirection wraps the identical
// LeadershipScopeService.getCourseScope(...).allCourses check the backend
// uses here), so this whole page is gated on it rather than hasPermission.
export function InstitutionalMachinesPage() {
  const { roleContext } = useAuth();
  const canManage = roleContext.isDirection;
  const queryClient = useQueryClient();

  const { data: rooms } = useQuery({ queryKey: ['rooms'], queryFn: listRooms, enabled: canManage });
  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: listCourses, enabled: canManage });
  const {
    data: machines,
    isLoading,
    error,
  } = useQuery({ queryKey: ['institutional-machines'], queryFn: listInstitutionalMachines, enabled: canManage });

  function roomName(id: string): string {
    return rooms?.find((room) => room.id === id)?.name ?? id;
  }

  function courseName(id: string): string {
    return courses?.find((course) => course.id === id)?.name ?? id;
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<InstitutionalMachineInput>(EMPTY_FORM);

  function updateField<K extends keyof InstitutionalMachineInput>(key: K, value: InstitutionalMachineInput[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function startEditing(machine: InstitutionalMachine) {
    setEditingId(machine.id);
    setForm({
      assetTag: machine.assetTag,
      serialNumber: machine.serialNumber,
      roomId: machine.roomId,
      status: machine.status,
      brand: machine.brand,
      model: machine.model,
      processor: machine.processor,
      memoryDescription: machine.memoryDescription,
      operatingSystem: machine.operatingSystem,
      courseId: machine.courseId,
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  const saveMutation = useMutation({
    mutationFn: (input: InstitutionalMachineInput) =>
      editingId ? updateInstitutionalMachine(editingId, input) : createInstitutionalMachine(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['institutional-machines'] });
      cancelEditing();
    },
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    saveMutation.mutate(form);
  }

  const enrollMutation = useMutation({
    mutationFn: (deviceIdentityId: string) => enrollDeviceCredential(deviceIdentityId),
  });

  const formComplete = Object.values(form).every((value) => value !== '');

  return (
    <section>
      <PageHeader
        icon={Monitor}
        area="settings"
        title="Máquinas institucionais"
        description="Inventário de estações de trabalho do parque institucional e matrícula da credencial WebAuthn de cada uma."
      />

      {!canManage && <RoleHint />}
      {canManage && isLoading && <Loading />}
      {canManage && error && <ErrorBanner message={errorMessage(error)} />}
      {canManage && enrollMutation.isError && <ErrorBanner message={errorMessage(enrollMutation.error)} />}
      {canManage && machines && (
        <DataTable<InstitutionalMachine>
          rows={machines}
          getRowKey={(machine) => machine.id}
          emptyMessage="Nenhuma máquina institucional cadastrada ainda."
          columns={[
            { header: 'Patrimônio', cell: (machine) => machine.assetTag },
            { header: 'Número de série', cell: (machine) => machine.serialNumber },
            { header: 'Sala', cell: (machine) => roomName(machine.roomId) },
            { header: 'Status', cell: (machine) => <Badge label={STATUS_LABELS[machine.status]} tone={STATUS_TONES[machine.status]} /> },
            { header: 'Marca / Modelo', cell: (machine) => `${machine.brand} / ${machine.model}` },
            { header: 'Processador', cell: (machine) => machine.processor },
            { header: 'Memória', cell: (machine) => machine.memoryDescription },
            { header: 'Sistema operacional', cell: (machine) => machine.operatingSystem },
            { header: 'Curso/depto.', cell: (machine) => courseName(machine.courseId) },
            {
              header: 'Ações',
              cell: (machine) => (
                <div className={styles.actionsCell}>
                  <button type="button" className={`secondary ${styles.iconButton}`} onClick={() => startEditing(machine)}>
                    <Pencil size={14} />
                    Editar
                  </button>
                  <button
                    type="button"
                    className={styles.iconButton}
                    disabled={enrollMutation.isPending && enrollMutation.variables === machine.id}
                    onClick={() => enrollMutation.mutate(machine.id)}
                  >
                    <KeyRound size={14} />
                    {enrollMutation.isPending && enrollMutation.variables === machine.id ? 'Matriculando…' : 'Matricular credencial'}
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {canManage && (
        <fieldset>
          <legend>{editingId ? 'Editar máquina institucional' : 'Cadastrar máquina institucional'}</legend>
          <form onSubmit={handleSubmit}>
            {saveMutation.isError && <ErrorBanner message={errorMessage(saveMutation.error)} />}

            {/* RULE-DEV-04, grupo 1 — patrimônio e número de série. */}
            <fieldset className={styles.fieldGroup}>
              <legend>Patrimônio e série</legend>
              <label>
                Patrimônio
                <input
                  type="text"
                  value={form.assetTag}
                  onChange={(event) => updateField('assetTag', event.target.value)}
                  required
                  maxLength={100}
                />
              </label>
              <label>
                Número de série
                <input
                  type="text"
                  value={form.serialNumber}
                  onChange={(event) => updateField('serialNumber', event.target.value)}
                  required
                  maxLength={100}
                />
              </label>
            </fieldset>

            {/* RULE-DEV-04, grupo 2 — sala/bloco e status. */}
            <fieldset className={styles.fieldGroup}>
              <legend>Sala e status</legend>
              <label>
                Sala
                <select value={form.roomId} onChange={(event) => updateField('roomId', event.target.value)} required>
                  <option value="" disabled>
                    Selecione uma sala
                  </option>
                  {rooms?.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value as InstitutionalMachineStatus)}
                  required
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {STATUS_LABELS[option]}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            {/* RULE-DEV-04, grupo 3 — especificação técnica. */}
            <fieldset className={styles.fieldGroup}>
              <legend>Especificação técnica</legend>
              <label>
                Marca
                <input type="text" value={form.brand} onChange={(event) => updateField('brand', event.target.value)} required maxLength={255} />
              </label>
              <label>
                Modelo
                <input type="text" value={form.model} onChange={(event) => updateField('model', event.target.value)} required maxLength={255} />
              </label>
              <label>
                Processador
                <input
                  type="text"
                  value={form.processor}
                  onChange={(event) => updateField('processor', event.target.value)}
                  required
                  maxLength={255}
                />
              </label>
              <label>
                Memória
                <input
                  type="text"
                  value={form.memoryDescription}
                  onChange={(event) => updateField('memoryDescription', event.target.value)}
                  required
                  maxLength={255}
                  placeholder="ex.: 16 GB DDR4"
                />
              </label>
              <label>
                Sistema operacional
                <input
                  type="text"
                  value={form.operatingSystem}
                  onChange={(event) => updateField('operatingSystem', event.target.value)}
                  required
                  maxLength={255}
                />
              </label>
            </fieldset>

            {/* RULE-DEV-04, grupo 4 — curso/departamento (RULE-DEV-05:
                metadado de inventário, nunca autorização de login). */}
            <fieldset className={styles.fieldGroup}>
              <legend>Curso / departamento responsável</legend>
              <label>
                Curso
                <select value={form.courseId} onChange={(event) => updateField('courseId', event.target.value)} required>
                  <option value="" disabled>
                    Selecione um curso
                  </option>
                  {courses?.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.name}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>

            <div className={styles.actionsCell}>
              <button type="submit" className={styles.iconButton} disabled={saveMutation.isPending || !formComplete}>
                <Plus size={16} />
                {saveMutation.isPending ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Cadastrar máquina'}
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
