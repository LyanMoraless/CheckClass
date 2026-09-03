import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { Modal } from '../../components/modal';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import {
  createExam,
  listExams,
  MONITORABLE_EVENT_TYPES,
  MONITORING_MODE_LABELS,
  MONITORING_MODES,
  EVENT_TYPE_LABELS,
  type ExamSummary,
  type MonitorableEventType,
  type MonitoringMode,
} from './exams-api';
import styles from './exams-page.module.css';

function toLocalInputValue(date: Date): string {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

// Teacher-facing list of a turma's exams, plus creation. Scoped to one turma
// because RULE-EXAM-16 makes "prova pertence a uma turma" structural — there
// is no institution-wide exam list to land on.
export function ExamsPage() {
  const { classGroupId = '' } = useParams();
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['exams', classGroupId],
    queryFn: () => listExams(classGroupId),
    enabled: Boolean(classGroupId),
  });

  return (
    <section>
      <PageHeader
        icon={FileText}
        area="portal"
        title="Provas da turma"
        description="Monte, configure e publique as provas desta turma. Uma prova só fica visível ao aluno depois de publicada."
        actions={
          <button type="button" onClick={() => setIsCreating(true)}>
            <Plus size={16} />
            Nova prova
          </button>
        }
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {data && (
        <DataTable<ExamSummary>
          rows={data}
          getRowKey={(exam) => exam.id}
          emptyMessage="Nenhuma prova criada para esta turma ainda."
          columns={[
            { header: 'Prova', cell: (exam) => exam.title },
            {
              header: 'Situação',
              cell: (exam) =>
                exam.status === 'PUBLISHED' ? (
                  <Badge tone="success" label="Publicada" />
                ) : (
                  <Badge tone="neutral" label="Rascunho" />
                ),
            },
            {
              header: 'Disponível',
              cell: (exam) =>
                `${new Date(exam.availableFrom).toLocaleString('pt-BR')} — ${new Date(exam.availableUntil).toLocaleString('pt-BR')}`,
            },
            {
              header: 'Duração',
              cell: (exam) => (exam.durationMinutes ? `${exam.durationMinutes} min` : 'Sem limite'),
            },
            {
              header: 'Ações',
              cell: (exam) => (
                <span className={styles.rowActions}>
                  <Link to={`/exams/${exam.id}/edit`}>Editar</Link>
                  <Link to={`/exams/${exam.id}/panel`}>Acompanhar</Link>
                </span>
              ),
            },
          ]}
        />
      )}

      {isCreating && (
        <CreateExamModal
          classGroupId={classGroupId}
          onClose={() => setIsCreating(false)}
          onCreated={() => {
            void queryClient.invalidateQueries({ queryKey: ['exams', classGroupId] });
            setIsCreating(false);
          }}
        />
      )}
    </section>
  );
}

function CreateExamModal({
  classGroupId,
  onClose,
  onCreated,
}: {
  classGroupId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availableFrom, setAvailableFrom] = useState(toLocalInputValue(now));
  const [availableUntil, setAvailableUntil] = useState(toLocalInputValue(inOneHour));
  const [hasTimeLimit, setHasTimeLimit] = useState(false);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [monitoringMode, setMonitoringMode] = useState<MonitoringMode>('LOG_ONLY');
  const [monitoredEventTypes, setMonitoredEventTypes] = useState<MonitorableEventType[]>([
    'PAGE_BLUR',
    'PAGE_VISIBILITY_CHANGED',
    'NEW_TAB_OR_WINDOW_ATTEMPT',
  ]);

  const mutation = useMutation({
    mutationFn: () =>
      createExam({
        classGroupId,
        title,
        description: description || undefined,
        availableFrom: new Date(availableFrom).toISOString(),
        availableUntil: new Date(availableUntil).toISOString(),
        durationMinutes: hasTimeLimit ? durationMinutes : null,
        monitoringMode,
        monitoredEventTypes,
      }),
    onSuccess: onCreated,
  });

  function toggleEventType(eventType: MonitorableEventType) {
    setMonitoredEventTypes((current) =>
      current.includes(eventType) ? current.filter((entry) => entry !== eventType) : [...current, eventType],
    );
  }

  return (
    <Modal title="Nova prova">
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate();
        }}
      >
        {mutation.error && <ErrorBanner message={errorMessage(mutation.error)} />}

        <label>
          Título
          <input value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={255} />
        </label>

        <label>
          Descrição (opcional)
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
        </label>

        {/* RULE-EXAM-06: the window says WHEN the exam can be started; the
            duration says how long each student gets after starting. Two
            independent settings, deliberately not derived from each other. */}
        <div className={styles.fieldRow}>
          <label>
            Disponível a partir de
            <input
              type="datetime-local"
              value={availableFrom}
              onChange={(event) => setAvailableFrom(event.target.value)}
              required
            />
          </label>
          <label>
            Disponível até
            <input
              type="datetime-local"
              value={availableUntil}
              onChange={(event) => setAvailableUntil(event.target.value)}
              required
            />
          </label>
        </div>

        <label className={styles.checkboxLabel}>
          <input type="checkbox" checked={hasTimeLimit} onChange={(event) => setHasTimeLimit(event.target.checked)} />
          Limitar o tempo de cada aluno após iniciar
        </label>
        {hasTimeLimit && (
          <label>
            Duração (minutos)
            <input
              type="number"
              min={1}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              required
            />
          </label>
        )}

        {/* RULE-EXAM-04 */}
        <label>
          Ao detectar uma ocorrência
          <select value={monitoringMode} onChange={(event) => setMonitoringMode(event.target.value as MonitoringMode)}>
            {MONITORING_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {MONITORING_MODE_LABELS[mode]}
              </option>
            ))}
          </select>
        </label>

        {/* RULE-EXAM-05 */}
        <fieldset className={styles.fieldset}>
          <legend>Eventos monitorados</legend>
          {MONITORABLE_EVENT_TYPES.map((eventType) => (
            <label key={eventType} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={monitoredEventTypes.includes(eventType)}
                onChange={() => toggleEventType(eventType)}
              />
              {EVENT_TYPE_LABELS[eventType]}
            </label>
          ))}
        </fieldset>

        <div className={styles.formActions}>
          <button type="button" className="secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Criando…' : 'Criar como rascunho'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
