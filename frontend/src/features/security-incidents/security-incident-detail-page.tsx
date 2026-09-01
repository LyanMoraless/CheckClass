import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, CheckCircle, MapPin, XCircle } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { Loading } from '../../components/loading';
import { PageHeader } from '../../components/page-header';
import { PermissionHint } from '../../components/permission-hint';
import { errorMessage } from '../../lib/api-client';
import { listCameras } from '../cameras/cameras-api';
import { useAuth } from '../auth/auth-context';
import { SECURITY_INCIDENT_OUTCOME_BADGE, SECURITY_INCIDENT_STATUS_BADGE } from './security-incident-labels';
import {
  closeSecurityIncident,
  getSecurityIncident,
  type CloseSecurityIncidentInput,
  type SecurityIncidentOutcome,
} from './security-incidents-api';
import styles from './security-incident-detail-page.module.css';

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
    return <ErrorBanner message="ID do incidente ausente na URL" />;
  }

  if (!canManage) {
    return (
      <section>
        <PageHeader icon={AlertTriangle} area="security" title="Detalhes do incidente de segurança" />
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

  // Purely cosmetic reflection of the already-selected <select> value — the
  // close action itself is still driven by that dropdown + the single submit
  // button below, unchanged from before.
  const OutcomeIcon = outcome === 'resolved' ? CheckCircle : XCircle;

  return (
    <section>
      <Link to="/security-incidents" className={styles.backLink}>
        <ArrowLeft size={16} />
        Voltar para incidentes de segurança
      </Link>

      <PageHeader icon={AlertTriangle} area="security" title="Detalhes do incidente de segurança" />

      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}

      {data && (
        <>
          <div className={styles.summaryCard}>
            <div className={styles.summaryHeader}>
              <Badge
                label={SECURITY_INCIDENT_STATUS_BADGE[data.incident.status].label}
                tone={SECURITY_INCIDENT_STATUS_BADGE[data.incident.status].tone}
              />
              {data.incident.status === 'open' && (
                <small>Atualizando automaticamente a cada {OPEN_INCIDENT_POLL_INTERVAL_MS / 1000}s</small>
              )}
            </div>
            <dl className={styles.summaryGrid}>
              <div className={styles.summaryItem}>
                <dt>Aberto em</dt>
                <dd>{new Date(data.incident.openedAt).toLocaleString()}</dd>
              </div>
              {data.incident.currentAreaId && (
                <div className={styles.summaryItem}>
                  <dt>Área atual</dt>
                  <dd>
                    <code>{data.incident.currentAreaId}</code>
                  </dd>
                </div>
              )}
              {data.incident.status === 'closed' && (
                <>
                  {data.incident.outcome && (
                    <div className={styles.summaryItem}>
                      <dt>Resultado</dt>
                      <dd>
                        <Badge
                          label={SECURITY_INCIDENT_OUTCOME_BADGE[data.incident.outcome].label}
                          tone={SECURITY_INCIDENT_OUTCOME_BADGE[data.incident.outcome].tone}
                        />
                      </dd>
                    </div>
                  )}
                  <div className={styles.summaryItem}>
                    <dt>Nota de resolução</dt>
                    <dd>{data.incident.resolutionNote}</dd>
                  </div>
                  {data.incident.closedAt && (
                    <div className={styles.summaryItem}>
                      <dt>Fechado em</dt>
                      <dd>{new Date(data.incident.closedAt).toLocaleString()}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>
          </div>

          <h2>Câmera sugerida</h2>
          {/* RULE-SEC-03's camera auto-follow, rendered as metadata only — the
              backend never provides a browser-playable stream (RTSP, no relay
              infra this round), so this is deliberately text, not a
              <video>/<img> pointed at the camera's streamUrl. */}
          <div className={styles.suggestedCamera}>
            {data.suggestedCameraId ? (
              <p>
                <strong>Câmera sugerida: {cameraLabel(data.suggestedCameraId)}</strong>
              </p>
            ) : (
              <p>Nenhuma câmera cobre atualmente a área estimada deste incidente.</p>
            )}
          </div>

          <h2>Histórico de localização</h2>
          <p className={styles.historyHint}>
            <small>RULE-SEC-02: este é um rastro de movimentação, não uma posição única — ordenado do mais antigo ao mais recente.</small>
          </p>
          {data.locationHistory.length === 0 ? (
            <p>Nenhuma entrada de localização registrada ainda.</p>
          ) : (
            <ol className={styles.historyList}>
              {data.locationHistory.map((entry) => (
                <li key={entry.id} className={styles.historyItem}>
                  <MapPin size={14} className={styles.historyIcon} />
                  <span>
                    {new Date(entry.detectedAt).toLocaleString()} — área <code>{entry.areaId}</code>
                  </span>
                </li>
              ))}
            </ol>
          )}

          {data.incident.status === 'open' && (
            <fieldset>
              <legend>Fechar incidente</legend>
              <form onSubmit={handleCloseSubmit}>
                {closeMutation.isError && <ErrorBanner message={errorMessage(closeMutation.error)} />}
                <label>
                  Resultado
                  <select value={outcome} onChange={(event) => setOutcome(event.target.value as SecurityIncidentOutcome)}>
                    <option value="resolved">Resolvido</option>
                    <option value="false_positive">Falso positivo</option>
                  </select>
                </label>
                <label>
                  Nota
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    required
                    placeholder="Obrigatório — descreva o motivo do fechamento"
                  />
                </label>
                <button type="submit" className={styles.closeButton} disabled={closeMutation.isPending || !note.trim()}>
                  <OutcomeIcon size={16} />
                  {closeMutation.isPending ? 'Fechando…' : 'Fechar incidente'}
                </button>
              </form>
            </fieldset>
          )}
        </>
      )}
    </section>
  );
}
