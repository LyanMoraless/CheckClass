import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { SECURITY_INCIDENT_OUTCOME_BADGE, SECURITY_INCIDENT_STATUS_BADGE } from './security-incident-labels';
import { listSecurityIncidents, type SecurityIncident, type SecurityIncidentStatus } from './security-incidents-api';
import styles from './security-incidents-page.module.css';

// Unlike the institutional screens (list visible to everyone, only the
// mutation gated), every route on SecurityIncidentController — including the
// list — requires manage_security_incidents (RULE-SEC-07). So the whole
// screen is gated here, not just the actions inside it.
export function SecurityIncidentsPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_security_incidents');

  const [statusFilter, setStatusFilter] = useState<SecurityIncidentStatus | ''>('open');
  const { data: incidents, isLoading, error } = useQuery({
    queryKey: ['security-incidents', statusFilter],
    queryFn: () => listSecurityIncidents(statusFilter || undefined),
    enabled: canManage,
  });

  if (!canManage) {
    return (
      <section>
        <PageHeader icon={AlertTriangle} area="security" title="Incidentes de segurança" />
        <PermissionHint permission="manage_security_incidents" />
      </section>
    );
  }

  return (
    <section>
      <PageHeader
        icon={AlertTriangle}
        area="security"
        title="Incidentes de segurança"
        description="Alertas de intrusão detectados automaticamente pelo sistema, do momento em que são abertos até o desfecho."
      />

      <div className={styles.filters}>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SecurityIncidentStatus | '')}>
            <option value="">Todos</option>
            <option value="open">Aberto</option>
            <option value="closed">Fechado</option>
          </select>
        </label>
      </div>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {incidents && (
        <DataTable<SecurityIncident>
          rows={incidents}
          getRowKey={(incident) => incident.id}
          emptyMessage="Nenhum incidente encontrado para o filtro selecionado."
          columns={[
            {
              header: 'Status',
              cell: (incident) => (
                <Badge label={SECURITY_INCIDENT_STATUS_BADGE[incident.status].label} tone={SECURITY_INCIDENT_STATUS_BADGE[incident.status].tone} />
              ),
            },
            { header: 'Área atual', cell: (incident) => (incident.currentAreaId ? <code>{incident.currentAreaId}</code> : '—') },
            { header: 'Aberto em', cell: (incident) => new Date(incident.openedAt).toLocaleString() },
            {
              header: 'Resultado',
              cell: (incident) =>
                incident.outcome ? (
                  <Badge label={SECURITY_INCIDENT_OUTCOME_BADGE[incident.outcome].label} tone={SECURITY_INCIDENT_OUTCOME_BADGE[incident.outcome].tone} />
                ) : (
                  '—'
                ),
            },
            {
              header: 'Ações',
              cell: (incident) => <Link to={`/security-incidents/${incident.id}`}>Ver</Link>,
            },
          ]}
        />
      )}
    </section>
  );
}
