import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Laptop, Unlink } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { errorMessage } from '../../lib/api-client';
import { enrollDeviceCredential } from './device-credential-api';
import { getMyPersonalDevice, registerPersonalDevice, revokePersonalDevice } from './personal-device-api';
import styles from './my-personal-device-page.module.css';

const QUERY_KEY = ['personal-devices', 'me'];

// RULE-DEV-02/17/18: self-service BYOD, open to ANY authenticated person —
// no permission/role gate, unlike institutional-machines-page.tsx. Cadastro
// (this page's register/revoke) and matrícula de credencial (the shared
// device-credential-api.ts ceremony) are deliberately two separate steps
// (RULE-DEV-01's reimage exception is exactly why a personal_device row can
// exist with no credential yet, or need a fresh one).
export function MyPersonalDevicePage() {
  const queryClient = useQueryClient();
  const { data: device, isLoading, error } = useQuery({ queryKey: QUERY_KEY, queryFn: getMyPersonalDevice });

  const [label, setLabel] = useState('');
  const registerMutation = useMutation({
    mutationFn: () => registerPersonalDevice(label.trim() || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      setLabel('');
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokePersonalDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  // Deliberate action (the person is standing at THIS notebook and clicked
  // this button right now) — unlike the ambient post-login offer in
  // device-binding, a failure here gets a real ErrorBanner, not a silent/soft
  // fallback. See device-credential-api.ts's header comment.
  const enrollMutation = useMutation({
    mutationFn: (id: string) => enrollDeviceCredential(id),
  });

  async function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault();
    registerMutation.mutate();
  }

  return (
    <section>
      <PageHeader
        icon={Laptop}
        area="core"
        title="Meu dispositivo pessoal"
        description="Registre seu próprio notebook (BYOD) para que ele conte como fator de vínculo de dispositivo, mesmo fora do parque institucional."
      />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}

      {!isLoading && !error && !device && (
        <fieldset>
          <legend>Registrar meu notebook</legend>
          <InfoBanner message="Você pode ter, no máximo, um dispositivo pessoal ativo por vez. Revogue o atual antes de registrar outro." />
          <form onSubmit={handleRegisterSubmit}>
            {registerMutation.isError && <ErrorBanner message={errorMessage(registerMutation.error)} />}
            <label>
              Apelido (opcional)
              <input
                type="text"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                maxLength={255}
                placeholder="ex.: Notebook pessoal"
              />
            </label>
            <button type="submit" className={styles.iconButton} disabled={registerMutation.isPending}>
              <Laptop size={16} />
              {registerMutation.isPending ? 'Registrando…' : 'Registrar meu dispositivo'}
            </button>
          </form>
        </fieldset>
      )}

      {device && (
        <div className={styles.card}>
          <dl>
            <div className={styles.row}>
              <dt>Apelido</dt>
              <dd>{device.label ?? 'Sem apelido'}</dd>
            </div>
            <div className={styles.row}>
              <dt>Registrado em</dt>
              <dd>{new Date(device.createdAt).toLocaleString()}</dd>
            </div>
          </dl>

          {enrollMutation.isError && <ErrorBanner message={errorMessage(enrollMutation.error)} />}
          {enrollMutation.isSuccess && <InfoBanner message="Credencial matriculada neste dispositivo." />}
          {revokeMutation.isError && <ErrorBanner message={errorMessage(revokeMutation.error)} />}

          <div className={styles.actions}>
            <button type="button" className={styles.iconButton} disabled={enrollMutation.isPending} onClick={() => enrollMutation.mutate(device.id)}>
              <KeyRound size={16} />
              {enrollMutation.isPending ? 'Matriculando…' : 'Matricular credencial neste dispositivo'}
            </button>
            <button
              type="button"
              className={`danger ${styles.iconButton}`}
              disabled={revokeMutation.isPending}
              onClick={() => revokeMutation.mutate(device.id)}
            >
              <Unlink size={16} />
              {revokeMutation.isPending ? 'Revogando…' : 'Revogar dispositivo'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
