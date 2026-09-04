import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Badge, type BadgeTone } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listClassGroups } from '../class-groups/class-groups-api';
import { listCourses } from '../courses/courses-api';
import {
  listConfigs,
  listFactorTypes,
  setRequiredFactors,
  upsertConfig,
  type AccumulatedFrequencyPeriod,
  type AttendanceConfig,
  type ConfigScopeType,
  type PostToleranceBehavior,
} from './attendance-config-api';
import styles from './attendance-config-page.module.css';

const POST_TOLERANCE_OPTIONS: PostToleranceBehavior[] = ['block_checkin', 'deny_presence', 'register_only'];

// AccumulatedFrequencyPeriod is a closed set of exactly three values
// (accumulated-frequency-period.enum.ts) — a select, never free text.
const ACCUMULATED_FREQUENCY_PERIOD_OPTIONS: AccumulatedFrequencyPeriod[] = ['bimester', 'trimester', 'semester'];

const ACCUMULATED_FREQUENCY_PERIOD_LABELS: Record<AccumulatedFrequencyPeriod, string> = {
  bimester: 'Bimestre',
  trimester: 'Trimestre',
  semester: 'Semestre',
};

// Display-only labels/tones for the raw enum values coming back from the
// API — the underlying value sent to/received from the backend is untouched.
const POST_TOLERANCE_LABELS: Record<PostToleranceBehavior, string> = {
  block_checkin: 'Bloquear check-in',
  deny_presence: 'Negar presença',
  register_only: 'Apenas registrar',
};

const POST_TOLERANCE_TONES: Record<PostToleranceBehavior, BadgeTone> = {
  block_checkin: 'danger',
  deny_presence: 'warning',
  register_only: 'info',
};

export function AttendanceConfigPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('configure_attendance_rules');
  const queryClient = useQueryClient();

  const { data: courses } = useQuery({ queryKey: ['courses'], queryFn: () => listCourses() });
  const { data: classGroups } = useQuery({ queryKey: ['class-groups', ''], queryFn: () => listClassGroups() });
  const { data: configs, isLoading, error } = useQuery({ queryKey: ['attendance-configs'], queryFn: listConfigs });

  function scopeLabel(config: AttendanceConfig): string {
    if (config.scopeType === 'institution') return 'Toda a instituição';
    if (config.scopeType === 'course') return `Curso: ${courses?.find((c) => c.id === config.scopeId)?.name ?? config.scopeId}`;
    return `Turma: ${classGroups?.find((g) => g.id === config.scopeId)?.name ?? config.scopeId}`;
  }

  const [scopeType, setScopeType] = useState<ConfigScopeType>('institution');
  const [scopeId, setScopeId] = useState('');
  const [minAttendancePercentage, setMinAttendancePercentage] = useState('75');
  // Controle B (RULE-FREQ-01/02) — required by upsert-config.dto.ts, so these
  // two always ride along in the same submit as Controle A above; there is
  // no separate save action for them.
  const [minAccumulatedFrequencyPercentage, setMinAccumulatedFrequencyPercentage] = useState('75');
  const [accumulatedFrequencyPeriod, setAccumulatedFrequencyPeriod] = useState<AccumulatedFrequencyPeriod>('bimester');
  const [toleranceMinutes, setToleranceMinutes] = useState('10');
  const [postToleranceBehavior, setPostToleranceBehavior] = useState<PostToleranceBehavior>('register_only');
  const [lastConfigId, setLastConfigId] = useState<string | null>(null);

  const upsertMutation = useMutation({
    mutationFn: upsertConfig,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-configs'] });
      setLastConfigId(result.configId);
    },
  });

  async function handleUpsertSubmit(event: FormEvent) {
    event.preventDefault();
    upsertMutation.mutate({
      scopeType,
      scopeId: scopeType === 'institution' ? undefined : scopeId,
      minAttendancePercentage: Number(minAttendancePercentage),
      minAccumulatedFrequencyPercentage: Number(minAccumulatedFrequencyPercentage),
      accumulatedFrequencyPeriod,
      toleranceMinutes: Number(toleranceMinutes),
      postToleranceBehavior,
    });
  }

  return (
    <section>
      <PageHeader
        icon={SlidersHorizontal}
        area="settings"
        title="Configuração de presença"
        description="Defina limites de presença, tolerância e fatores obrigatórios por instituição, curso ou turma."
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {configs && (
        <DataTable<AttendanceConfig>
          rows={configs}
          getRowKey={(config) => config.id}
          columns={[
            { header: 'Escopo', cell: scopeLabel },
            {
              header: 'Controle A — % mín. por aula',
              cell: (config) => config.minAttendancePercentage,
            },
            {
              header: 'Controle B — % mín. acumulado',
              cell: (config) => config.minAccumulatedFrequencyPercentage,
            },
            {
              header: 'Controle B — período de apuração',
              cell: (config) => ACCUMULATED_FREQUENCY_PERIOD_LABELS[config.accumulatedFrequencyPeriod],
            },
            { header: 'Tolerância (min)', cell: (config) => config.toleranceMinutes },
            {
              header: 'Comportamento pós-tolerância',
              cell: (config) => (
                <Badge
                  label={POST_TOLERANCE_LABELS[config.postToleranceBehavior]}
                  tone={POST_TOLERANCE_TONES[config.postToleranceBehavior]}
                />
              ),
            },
            { header: 'ID da configuração', cell: (config) => <code>{config.id}</code> },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Criar / atualizar configuração</legend>
        {!canManage && <PermissionHint permission="configure_attendance_rules" />}
        <InfoBanner message="Ordem de resolução: a configuração da turma prevalece sobre a do seu curso, que prevalece sobre o padrão da instituição. Enviar novamente para o mesmo escopo o atualiza (não há uma ação de edição separada)." />
        <form onSubmit={handleUpsertSubmit}>
          {upsertMutation.isError && <ErrorBanner message={errorMessage(upsertMutation.error)} />}
          <label>
            Tipo de escopo
            <select
              value={scopeType}
              onChange={(event) => {
                setScopeType(event.target.value as ConfigScopeType);
                setScopeId('');
              }}
            >
              <option value="institution">Instituição</option>
              <option value="course">Curso</option>
              <option value="class_group">Turma</option>
            </select>
          </label>

          {scopeType === 'course' && (
            <label>
              Curso
              <select value={scopeId} onChange={(event) => setScopeId(event.target.value)} required>
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
          )}

          {scopeType === 'class_group' && (
            <label>
              Turma
              <select value={scopeId} onChange={(event) => setScopeId(event.target.value)} required>
                <option value="" disabled>
                  Selecione uma turma
                </option>
                {classGroups?.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Controle A (RULE-ATT-04/05/13/14): a per-CLASS check — did the
              student stay present for enough of THIS specific aula. Grouped
              and labelled apart from Controle B below on purpose: the two
              minimums look identical (both are "% mínimo") but answer
              different questions, and an administrator who conflates them
              misconfigures the institution. */}
          <fieldset className={styles.controlGroup}>
            <legend>Controle A — presença dentro de cada aula</legend>
            <p className={styles.helperText}>
              "O aluno permaneceu tempo suficiente NESTA aula?" — aplicado aula a aula, no momento do registro de
              presença.
            </p>
            <label>
              Percentual mínimo de presença por aula
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={minAttendancePercentage}
                onChange={(event) => setMinAttendancePercentage(event.target.value)}
                required
              />
            </label>
            <label>
              Tolerância (minutos)
              <input
                type="number"
                min={0}
                step="1"
                value={toleranceMinutes}
                onChange={(event) => setToleranceMinutes(event.target.value)}
                required
              />
            </label>
            <label>
              Comportamento pós-tolerância
              <select value={postToleranceBehavior} onChange={(event) => setPostToleranceBehavior(event.target.value as PostToleranceBehavior)}>
                {POST_TOLERANCE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {POST_TOLERANCE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          {/* Controle B (RULE-FREQ-01/02/03): a per-PERIOD check — did the
              student attend enough of the classes ACROSS the reporting
              period (bimestre/trimestre/semestre), independent of how any
              single aula went. Both fields are REQUIRED by
              upsert-config.dto.ts — there is no optional/partial submit. */}
          <fieldset className={styles.controlGroup}>
            <legend>Controle B — frequência acumulada no período</legend>
            <p className={styles.helperText}>
              "O aluno compareceu a aulas suficientes NO PERÍODO?" — apurado ao longo do bimestre/trimestre/semestre;
              gera o aviso de frequência exibido ao aluno quando ele se aproxima ou cai abaixo deste mínimo.
            </p>
            <label>
              Percentual mínimo de frequência acumulada
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={minAccumulatedFrequencyPercentage}
                onChange={(event) => setMinAccumulatedFrequencyPercentage(event.target.value)}
                required
              />
            </label>
            <label>
              Período de apuração
              <select
                value={accumulatedFrequencyPeriod}
                onChange={(event) => setAccumulatedFrequencyPeriod(event.target.value as AccumulatedFrequencyPeriod)}
                required
              >
                {ACCUMULATED_FREQUENCY_PERIOD_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {ACCUMULATED_FREQUENCY_PERIOD_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </fieldset>

          <button
            type="submit"
            className={styles.iconButton}
            disabled={upsertMutation.isPending || (scopeType !== 'institution' && !scopeId)}
          >
            <Save size={16} />
            {upsertMutation.isPending ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </form>
      </fieldset>

      <RequiredFactorsSection canManage={canManage} defaultConfigId={lastConfigId} configs={configs} />
    </section>
  );
}

function RequiredFactorsSection({
  canManage,
  defaultConfigId,
  configs,
}: {
  canManage: boolean;
  defaultConfigId: string | null;
  configs: AttendanceConfig[] | undefined;
}) {
  const { data: factorTypes } = useQuery({ queryKey: ['factor-types'], queryFn: listFactorTypes });
  const [configId, setConfigId] = useState(defaultConfigId ?? '');
  const [selectedFactors, setSelectedFactors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (defaultConfigId) {
      setConfigId(defaultConfigId);
    }
  }, [defaultConfigId]);

  const mutation = useMutation({
    mutationFn: () => setRequiredFactors(configId, Array.from(selectedFactors)),
  });

  function toggleFactor(id: string) {
    setSelectedFactors((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <fieldset disabled={!canManage}>
      <legend>Fatores obrigatórios de uma configuração</legend>
      {!canManage && <PermissionHint permission="configure_attendance_rules" />}
      <form onSubmit={handleSubmit}>
        {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
        {mutation.isSuccess && <InfoBanner message="Fatores obrigatórios salvos." />}
        <label>
          Configuração
          <select value={configId} onChange={(event) => setConfigId(event.target.value)} required>
            <option value="" disabled>
              Selecione uma configuração
            </option>
            {configs?.map((config) => (
              <option key={config.id} value={config.id}>
                {config.scopeType} — {config.id}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Fatores</legend>
          {factorTypes?.map((factor) => (
            <label key={factor.id} className={styles.checkboxRow}>
              <input type="checkbox" checked={selectedFactors.has(factor.id)} onChange={() => toggleFactor(factor.id)} />
              {factor.name}
            </label>
          ))}
        </fieldset>
        <button type="submit" className={styles.iconButton} disabled={mutation.isPending || !configId}>
          <Save size={16} />
          {mutation.isPending ? 'Salvando…' : 'Salvar fatores obrigatórios'}
        </button>
      </form>
    </fieldset>
  );
}
