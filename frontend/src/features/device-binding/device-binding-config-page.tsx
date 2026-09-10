import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save, Timer } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
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

  useEffect(() => {
    if (config) {
      setMinutes(String(config.inactivityTimeoutMinutes));
    }
  }, [config]);

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
              onChange={(event) => setMinutes(event.target.value)}
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
