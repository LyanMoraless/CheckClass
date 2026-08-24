import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DataTable } from '../../components/data-table';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { useAuth } from '../auth/auth-context';
import { listSecurityIncidents, type SecurityIncident, type SecurityIncidentStatus } from './security-incidents-api';

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
        <h1>Security incidents</h1>
        <PermissionHint permission="manage_security_incidents" />
      </section>
    );
  }

  return (
    <section>
      <h1>Security incidents</h1>
      <label>
        Status
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as SecurityIncidentStatus | '')}>
          <option value="">All</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
      </label>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}
      {incidents && (
        <DataTable<SecurityIncident>
          rows={incidents}
          getRowKey={(incident) => incident.id}
          columns={[
            { header: 'Status', cell: (incident) => incident.status },
            { header: 'Current area', cell: (incident) => (incident.currentAreaId ? <code>{incident.currentAreaId}</code> : '—') },
            { header: 'Opened at', cell: (incident) => new Date(incident.openedAt).toLocaleString() },
            { header: 'Outcome', cell: (incident) => (incident.outcome ? incident.outcome : '—') },
            {
              header: 'Actions',
              cell: (incident) => <Link to={`/security-incidents/${incident.id}`}>View</Link>,
            },
          ]}
        />
      )}
    </section>
  );
}
