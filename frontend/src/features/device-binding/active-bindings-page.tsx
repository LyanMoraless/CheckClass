import { useQuery } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import { Badge, type BadgeTone } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listPersons } from '../users/users-api';
import { listDeviceBindings, type CheckoutReason, type DeviceBinding } from './device-binding-api';

const REASON_LABELS: Record<CheckoutReason, string> = {
  logout: 'Logout',
  session_end: 'Fim da sessão de aula',
  inactivity_timeout: 'Inatividade',
  token_expired: 'Token expirado',
};

function statusBadge(status: DeviceBinding['status']) {
  const isActive = status === 'active';
  const tone: BadgeTone = isActive ? 'success' : 'neutral';
  return <Badge label={isActive ? 'Ativo' : 'Encerrado'} tone={tone} />;
}

// RULE-DEV-13/RULE-ACC-08: "quem está/esteve em qual máquina" — gated by
// VIEW_DEVICE_BINDINGS (titular padrão coordenação + diretoria/reitoria,
// RULE-DEV-16), not a role check like institutional-machines-page.tsx. Same
// "always show the nav link, gate content inside the page" convention as
// every other permission-gated screen in this app (see cameras-page.tsx).
export function ActiveBindingsPage() {
  const { hasPermission } = useAuth();
  const canView = hasPermission('view_device_bindings');

  const {
    data: bindings,
    isLoading,
    error,
  } = useQuery({ queryKey: ['device-bindings'], queryFn: listDeviceBindings, enabled: canView });

  // Best-effort name resolution — listPersons() is gated MANAGE_USERS, a
  // different permission from view_device_bindings, so a viewer here may not
  // have it. Falls back to the raw personId, same posture PersonIdField
  // already establishes for this exact cross-permission gap.
  const { data: persons } = useQuery({ queryKey: ['persons'], queryFn: listPersons, enabled: canView, retry: false });

  function personLabel(personId: string): string {
    return persons?.find((person) => person.personId === personId)?.fullName ?? personId;
  }

  return (
    <section>
      <PageHeader
        icon={Link2}
        area="settings"
        title="Vínculos de dispositivo"
        description="Vínculos ativos e histórico de uso — quem está, ou esteve, em qual máquina institucional ou dispositivo pessoal."
      />

      {!canView && <PermissionHint permission="view_device_bindings" />}
      {canView && isLoading && <Loading />}
      {canView && error && <ErrorBanner message={errorMessage(error)} />}
      {canView && bindings && (
        <DataTable<DeviceBinding>
          rows={bindings}
          getRowKey={(binding) => binding.id}
          emptyMessage="Nenhum vínculo de dispositivo registrado ainda."
          columns={[
            { header: 'Pessoa', cell: (binding) => personLabel(binding.personId) },
            { header: 'Dispositivo', cell: (binding) => <code>{binding.deviceIdentityId}</code> },
            { header: 'Status', cell: (binding) => statusBadge(binding.status) },
            { header: 'Início', cell: (binding) => new Date(binding.startedAt).toLocaleString() },
            {
              header: 'Encerrado em',
              cell: (binding) => (binding.checkedOutAt ? new Date(binding.checkedOutAt).toLocaleString() : '—'),
            },
            {
              header: 'Motivo do encerramento',
              cell: (binding) => (binding.checkoutReason ? REASON_LABELS[binding.checkoutReason] : '—'),
            },
          ]}
        />
      )}
    </section>
  );
}
