import { useQuery } from '@tanstack/react-query';
import { Badge } from '../../components/badge';
import { ErrorBanner } from '../../components/error-banner';
import { InfoBanner } from '../../components/info-banner';
import { Loading } from '../../components/loading';
import { Modal } from '../../components/modal';
import { errorMessage } from '../../lib/api-client';
import { getClassSessionHeadcountAlert, type ClassroomHeadcountWindow } from './class-session-headcount-alert-api';
import styles from './headcount-alert-modal.module.css';

// LOAD PARAMETER, NOT A UX KNOB — same idiom/reasoning as
// StudentWarningsPage's WARNINGS_POLL_INTERVAL_MS. The camera itself only
// produces a new reading every 15 minutes (RULE-PRES-11's fixed cadence), so
// polling this endpoint faster never changes the WINDOWS it returns — this
// interval exists only to notice a session starting/ending, or a new window
// landing, reasonably soon after it happens, while the professor has this
// modal open. Only active while the modal is mounted (this component is
// unmounted on close), so it never runs in the background.
const HEADCOUNT_ALERT_POLL_INTERVAL_MS = 60000;

interface HeadcountAlertModalProps {
  classSessionId: string;
  classGroupName: string;
  onClose: () => void;
}

// RULE-PRES-10/11 (Bloco 4 — Contagem por câmera como cruzamento). Shows the
// three numbers the backend cross-checks (câmera × login/tag via app ×
// "em sala" via tag) for ONE aula currently in andamento, plus whether the
// divergence alert is active (RULE-PRES-11: >=5, confirmed in the two most
// recent camera readings). Deliberately no action button of any kind here —
// RULE-PRES-10 keeps the actual presença decision a manual chamada made by
// the professor, outside this screen; this modal is read-only, purely
// informative, same posture as the backend endpoint it reads.
export function HeadcountAlertModal({ classSessionId, classGroupName, onClose }: HeadcountAlertModalProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['class-session-headcount-alert', classSessionId],
    queryFn: () => getClassSessionHeadcountAlert(classSessionId),
    refetchInterval: HEADCOUNT_ALERT_POLL_INTERVAL_MS,
  });

  return (
    <Modal title={`Contagem da aula — ${classGroupName}`}>
      {isLoading && <Loading />}
      {error && <ErrorBanner message={errorMessage(error)} />}

      {/* inProgress: false is a normal state (aula ainda não começou, ou já
          terminou) — never rendered as an error. */}
      {data && !data.inProgress && (
        <InfoBanner message="Esta aula não está em andamento no momento — a contagem por câmera só é avaliada durante a aula." />
      )}

      {/* inProgress with no windows yet is also normal — a session that just
          started hasn't had a 15-minute camera reading yet. */}
      {data && data.inProgress && data.windows.length === 0 && (
        <InfoBanner message="Ainda não há leituras de câmera suficientes nesta aula para cruzar os números." />
      )}

      {data && data.inProgress && data.windows.length > 0 && (
        <div>
          <p className={styles.description}>
            Pessoas vistas pela câmera, logins/tags confirmados pelo aplicativo e pessoas "em sala" pela tag, na(s) leitura(s)
            mais recente(s) desta aula.
          </p>
          <Badge
            label={data.alertActive ? 'Divergência confirmada' : 'Sem divergência confirmada'}
            tone={data.alertActive ? 'danger' : 'success'}
          />
          <ul className={styles.windowList}>
            {data.windows.map((window) => (
              <WindowRow key={window.capturedAt} window={window} />
            ))}
          </ul>
          {data.windows.length === 1 && (
            <InfoBanner message="Apenas uma leitura de câmera até agora — o alerta exige duas leituras seguidas com a mesma divergência para ser confirmado (RULE-PRES-11)." />
          )}
        </div>
      )}

      <button type="button" className={`secondary ${styles.closeButton}`} onClick={onClose}>
        Fechar
      </button>
    </Modal>
  );
}

function WindowRow({ window }: { window: ClassroomHeadcountWindow }) {
  return (
    <li className={styles.windowRow}>
      <p className={styles.windowTime}>{new Date(window.capturedAt).toLocaleString('pt-BR')}</p>
      <dl className={styles.windowGrid}>
        <div>
          <dt>Vistos pela câmera</dt>
          <dd>{window.cameraCount}</dd>
        </div>
        <div>
          <dt>Login/tag confirmados</dt>
          <dd>{window.appCheckinCount}</dd>
        </div>
        <div>
          <dt>Em sala (tag)</dt>
          <dd>{window.roomPresenceCount}</dd>
        </div>
      </dl>
    </li>
  );
}
