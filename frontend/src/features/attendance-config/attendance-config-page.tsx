import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type FormEvent } from 'react';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
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
  type AttendanceConfig,
  type ConfigScopeType,
  type PostToleranceBehavior,
} from './attendance-config-api';

const POST_TOLERANCE_OPTIONS: PostToleranceBehavior[] = ['block_checkin', 'deny_presence', 'register_only'];

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
      toleranceMinutes: Number(toleranceMinutes),
      postToleranceBehavior,
    });
  }

  return (
    <section>
      <h1>Configuração de presença</h1>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {configs && (
        <DataTable<AttendanceConfig>
          rows={configs}
          getRowKey={(config) => config.id}
          columns={[
            { header: 'Escopo', cell: scopeLabel },
            { header: '% mínimo de presença', cell: (config) => config.minAttendancePercentage },
            { header: 'Tolerância (min)', cell: (config) => config.toleranceMinutes },
            { header: 'Comportamento pós-tolerância', cell: (config) => config.postToleranceBehavior },
            { header: 'ID da configuração', cell: (config) => <code>{config.id}</code> },
          ]}
        />
      )}

      <fieldset disabled={!canManage}>
        <legend>Criar / atualizar configuração</legend>
        {!canManage && <PermissionHint permission="configure_attendance_rules" />}
        <p>
          <small>
            Ordem de resolução: a configuração da turma prevalece sobre a do seu curso, que prevalece sobre o padrão da
            instituição. Enviar novamente para o mesmo escopo o atualiza (não há uma ação de edição separada).
          </small>
        </p>
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

          <label>
            Percentual mínimo de presença
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
                  {option}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" disabled={upsertMutation.isPending || (scopeType !== 'institution' && !scopeId)}>
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
        {mutation.isSuccess && <p>Fatores obrigatórios salvos.</p>}
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
            <label key={factor.id} style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', maxWidth: 'none' }}>
              <input type="checkbox" checked={selectedFactors.has(factor.id)} onChange={() => toggleFactor(factor.id)} />
              {factor.name}
            </label>
          ))}
        </fieldset>
        <button type="submit" disabled={mutation.isPending || !configId}>
          {mutation.isPending ? 'Salvando…' : 'Salvar fatores obrigatórios'}
        </button>
      </form>
    </fieldset>
  );
}
