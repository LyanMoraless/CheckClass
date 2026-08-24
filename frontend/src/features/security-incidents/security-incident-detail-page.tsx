import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { listCameras } from '../cameras/cameras-api';
import { useAuth } from '../auth/auth-context';
import {
  closeSecurityIncident,
  getSecurityIncident,
  type CloseSecurityIncidentInput,
  type SecurityIncidentOutcome,
} from './security-incidents-api';

// This screen represents an OPEN alert that changes over time (RULE-SEC-03:
// the "suggested camera" follows as the intruder moves between areas). The
// approved alert-delivery design is polling, not push, so this re-fetches on
// an interval while the incident is open and stops once it's closed.
const OPEN_INCIDENT_POLL_INTERVAL_MS = 4000;

export function SecurityIncidentDetailPage() {
  const { incidentId } = useParams<{ incidentId: string }>();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('manage_security_incidents');

  if (!incidentId) {
    return <ErrorBanner message="Missing incident id in the URL" />;
  }

  if (!canManage) {
    return (
      <section>
        <h1>Security incident detail</h1>
        <PermissionHint permission="manage_security_incidents" />
      </section>
    );
  }

  return <IncidentDetail incidentId={incidentId} />;
}

function IncidentDetail({ incidentId }: { incidentId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['security-incident', incidentId],
    queryFn: () => getSecurityIncident(incidentId),
    refetchInterval: (query) => (query.state.data?.incident.status === 'open' ? OPEN_INCIDENT_POLL_INTERVAL_MS : false),
  });

  // Camera list is gated independently (view_camera / view_sector_cameras —
  // RULE-ACC-07's codes are independent of manage_security_incidents), so a
  // security-team member without either just sees the raw camera id instead
  // of its name — same tolerate-403 fallback PersonIdField already uses.
  const { data: cameras } = useQuery({ queryKey: ['cameras'], queryFn: listCameras, retry: false });

  const [outcome, setOutcome] = useState<SecurityIncidentOutcome>('resolved');
  const [note, setNote] = useState('');
  const closeMutation = useMutation({
    mutationFn: (input: CloseSecurityIncidentInput) => closeSecurityIncident(incidentId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-incident', incidentId] });
      queryClient.invalidateQueries({ queryKey: ['security-incidents'] });
      setNote('');
    },
  });

  async function handleCloseSubmit(event: FormEvent) {
    event.preventDefault();
    if (!note.trim()) {
      return;
    }
    closeMutation.mutate({ outcome, note: note.trim() });
  }

  function cameraLabel(cameraId: string): string {
    const camera = cameras?.find((c) => c.id === cameraId);
    return camera ? `${camera.name} — Área ${camera.areaId}` : cameraId;
  }

  return (
    <section>
      <p>
        <Link to="/security-incidents">&larr; Back to security incidents</Link>
      </p>
      <h1>Security incident detail</h1>

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}

      {data && (
        <>
          <p>
            Status: <strong>{data.incident.status}</strong>
            {data.incident.status === 'open' && (
              <small> — refreshing automatically every {OPEN_INCIDENT_POLL_INTERVAL_MS / 1000}s</small>
            )}
          </p>
          <p>Opened at: {new Date(data.incident.openedAt).toLocaleString()}</p>
          {data.incident.currentAreaId && (
            <p>
              Current area: <code>{data.incident.currentAreaId}</code>
            </p>
          )}
          {data.incident.status === 'closed' && (
            <>
              <p>Outcome: {data.incident.outcome}</p>
              <p>Resolution note: {data.incident.resolutionNote}</p>
              {data.incident.closedAt && <p>Closed at: {new Date(data.incident.closedAt).toLocaleString()}</p>}
            </>
          )}

          <h2>Suggested camera</h2>
          {/* RULE-SEC-03's camera auto-follow, rendered as metadata only — the
              backend never provides a browser-playable stream (RTSP, no relay
              infra this round), so this is deliberately text, not a
              <video>/<img> pointed at the camera's streamUrl. */}
          {data.suggestedCameraId ? (
            <p>
              <strong>Câmera sugerida: {cameraLabel(data.suggestedCameraId)}</strong>
            </p>
          ) : (
            <p>No camera currently covers this incident's estimated area.</p>
          )}

          <h2>Location history</h2>
          <p>
            <small>RULE-SEC-02: this is a movement trail, not a single position — ordered oldest to newest.</small>
          </p>
          {data.locationHistory.length === 0 ? (
            <p>No location entries recorded yet.</p>
          ) : (
            <ol>
              {data.locationHistory.map((entry) => (
                <li key={entry.id}>
                  {new Date(entry.detectedAt).toLocaleString()} — area <code>{entry.areaId}</code>
                </li>
              ))}
            </ol>
          )}

          {data.incident.status === 'open' && (
            <fieldset>
              <legend>Close incident</legend>
              <form onSubmit={handleCloseSubmit}>
                {closeMutation.isError && <ErrorBanner message={errorMessage(closeMutation.error)} />}
                <label>
                  Outcome
                  <select value={outcome} onChange={(event) => setOutcome(event.target.value as SecurityIncidentOutcome)}>
                    <option value="resolved">Resolvido</option>
                    <option value="false_positive">Falso positivo</option>
                  </select>
                </label>
                <label>
                  Note
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    required
                    placeholder="Mandatory — describe the closure reason"
                  />
                </label>
                <button type="submit" disabled={closeMutation.isPending || !note.trim()}>
                  {closeMutation.isPending ? 'Closing…' : 'Close incident'}
                </button>
              </form>
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}
