import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, ShieldOff, Unlink } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PersonIdField } from '../../components/person-id-field';
import { RoleHint } from '../../components/role-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { findPersonalDeviceByPerson, revokePersonalDevice } from './personal-device-api';
import styles from './personal-device-admin-page.module.css';

// RULE-DEV-18 admin flow: the inventory administrator (Direção/Reitoria,
// RULE-DEV-15) searches a person's active BYOD by personId and revokes it
// administratively — my-personal-device-page.tsx already covers the OTHER
// titular this rule names (the owner's own self-service revoke, over their
// OWN device only). This page reuses the exact same revokePersonalDevice()
// call — revoke() is authorized server-side for either titular
// (personal-device.service.ts), not duplicated here. Gated on
// roleContext.isDirection, no dedicated Permission code — same mechanism as
// institutional-machines-page.tsx (RULE-DEV-15/RULE-ACC-08). Deliberately
// NOT opened to Coordenação: RULE-DEV-15's 2026-09-11 widening only reaches
// *visualização* of the institutional-machine inventory, never BYOD
// administration/revocation.
export function PersonalDeviceAdminPage() {
  const { roleContext } = useAuth();
  const canManage = roleContext.isDirection;
  const queryClient = useQueryClient();

  const [personIdInput, setPersonIdInput] = useState('');
  const [searchedPersonId, setSearchedPersonId] = useState<string | null>(null);

  const queryKey = ['personal-devices', 'by-person', searchedPersonId];
  const {
    data: device,
    isLoading,
    error,
  } = useQuery({
    queryKey,
    queryFn: () => findPersonalDeviceByPerson(searchedPersonId as string),
    enabled: canManage && searchedPersonId !== null,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokePersonalDevice(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  function handleSearch(event: FormEvent) {
    event.preventDefault();
    const trimmed = personIdInput.trim();
    if (!trimmed) {
      return;
    }
    setSearchedPersonId(trimmed);
  }

  return (
    <section>
      <PageHeader
        icon={ShieldOff}
        area="settings"
        title="Revogar dispositivo pessoal (BYOD)"
        description="Busque uma pessoa pelo ID para ver e revogar administrativamente o dispositivo pessoal (BYOD) vinculado a ela (RULE-DEV-18) — ex.: perda, roubo ou desligamento."
      />

      {!canManage && <RoleHint />}

      {canManage && (
        <>
          <form className={styles.searchForm} onSubmit={handleSearch}>
            <PersonIdField label="Pessoa" value={personIdInput} onChange={setPersonIdInput} required />
            <button type="submit" className={styles.iconButton} disabled={!personIdInput.trim()}>
              <Search size={16} />
              Buscar
            </button>
          </form>

          {isLoading && <Loading />}
          {error && <ErrorBanner message={errorMessage(error)} />}
          {revokeMutation.isError && <ErrorBanner message={errorMessage(revokeMutation.error)} />}

          {searchedPersonId && !isLoading && !error && !device && (
            <InfoBanner message="Esta pessoa não tem nenhum dispositivo pessoal (BYOD) ativo." />
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
          )}
        </>
      )}
    </section>
  );
}
