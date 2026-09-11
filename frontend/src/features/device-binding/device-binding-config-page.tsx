import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Timer } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { RoleHint } from '../../components/role-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { getDeviceBindingConfig, upsertDeviceBindingConfig } from './device-binding-api';
import styles from './device-binding-config-page.module.css';

const QUERY_KEY = ['device-binding-config'];

// Gatilho 3's configurable inactivity threshold (RULE-DEV-06) — read is open
// to any authenticated person (device-binding.controller.ts's getConfig()
// has no gate at all), write is Direção/Reitoria only, same LeadershipScopeService
// mechanism as institutional-machines-page.tsx (no dedicated Permission code
// exists for this — device-binding-config.service.ts's own header comment).
export function DeviceBindingConfigPage() {
  const { roleContext } = useAuth();
  const canManage = roleContext.isDirection;
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: getDeviceBindingConfig });
  const [minutes, setMinutes] = useState('30');
  // Guards against a real race: the initial config fetch can resolve in the
  // very same render/commit as the user's first keystroke in the field
  // below (e.g. a fast edit right as the page finishes loading). Without
  // this guard, this sync-from-server effect unconditionally overwrites
  // `minutes` whenever `config` changes identity — including that first
  // arrival — silently discarding whatever the Direção/Reitoria user just
  // typed. A ref (not state) is used so the flag is visible to the effect
  // within the very same commit that set it, with no extra render. Caught
  // by test_deviceBindingConfigPage_isDirection_submitsUpdatedMinutes.
  const hasUserEditedRef = useRef(false);
  useEffect(() => {
    if (config && !hasUserEditedRef.current) {
      setMinutes(String(config.inactivityTimeoutMinutes));
    }
  }, [config]);

  function handleMinutesChange(value: string) {
    hasUserEditedRef.current = true;
    setMinutes(value);
  }

  const mutation = useMutation({
    mutationFn: () => upsertDeviceBindingConfig(Number(minutes)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <section>
      <PageHeader
        icon={Timer}
        area="settings"
        title="Configuração de vínculo de dispositivo"
        description="Define o limite de inatividade (Gatilho 3) que encerra automaticamente um vínculo de dispositivo sem uso."
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {config?.isDefault && (
        <InfoBanner message="Nenhuma configuração própria foi definida por esta instituição ainda — o valor abaixo é o padrão da plataforma (30 minutos), não uma escolha institucional." />
      )}

      <fieldset disabled={!canManage}>
        <legend>Limite de inatividade</legend>
        {!canManage && <RoleHint />}
        <form onSubmit={handleSubmit}>
          {mutation.isError && <ErrorBanner message={errorMessage(mutation.error)} />}
          {mutation.isSuccess && <InfoBanner message="Configuração salva." />}
          <label>
            Minutos de inatividade até o checkout automático
            <input
              type="number"
              min={1}
              step="1"
              value={minutes}
              onChange={(event) => handleMinutesChange(event.target.value)}
              required
            />
          </label>
          <button type="submit" className={styles.iconButton} disabled={mutation.isPending || !minutes}>
            <Save size={16} />
            {mutation.isPending ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </form>
      </fieldset>
    </section>
  );
}
