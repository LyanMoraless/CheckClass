import { Fingerprint } from 'lucide-react';
import { InfoBanner } from '../../components/info-banner';
import type { DeviceBindingSession } from './use-device-binding-session';
import styles from './device-link-prompt.module.css';

// Renders Tech Decision C's "vincular este dispositivo" offer — the ONLY UI
// this feature shows ambiently, and only in the 'offering'/'binding'/'bound'/
// 'failed' states (use-device-binding-session.ts already decides when those
// apply; this component just renders whichever one it's handed). 'checking'
// and 'hidden' render nothing at all, including the GAP-09 "no capability"
// case, exactly as approved ("sem UI nenhuma, sem erro, sem aviso").
export function DeviceLinkPrompt({ offerState, bindThisDevice, dismissOffer }: DeviceBindingSession) {
  if (offerState === 'checking' || offerState === 'hidden') {
    return null;
  }

  if (offerState === 'bound') {
    return (
      <div className={styles.banner}>
        <InfoBanner message="Dispositivo vinculado a esta sessão." />
        <button type="button" className={`secondary ${styles.iconButton}`} onClick={dismissOffer}>
          Ok
        </button>
      </div>
    );
  }

  if (offerState === 'failed') {
    // Neutral, not alarming — RULE-DEV-02/GAP-09 treats this exactly like an
    // unknown machine, and it is EXPECTED to happen constantly (most
    // machines have no credential enrolled yet, or the person just declined
    // the platform prompt). Never an ErrorBanner here.
    return (
      <div className={styles.banner}>
        <InfoBanner message="Não foi possível vincular este dispositivo agora. Você pode tentar novamente mais tarde — seu login continua normal." />
        <button type="button" className={`secondary ${styles.iconButton}`} onClick={dismissOffer}>
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className={styles.banner}>
      <Fingerprint size={20} className={styles.icon} />
      <p className={styles.text}>
        Este dispositivo suporta biometria/PIN do sistema. Deseja vincular este computador à sua sessão? Isso conta como um
        fator adicional de confirmação na chamada, quando a instituição exigir.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.iconButton}
          disabled={offerState === 'binding'}
          onClick={() => void bindThisDevice()}
        >
          <Fingerprint size={14} />
          {offerState === 'binding' ? 'Vinculando…' : 'Vincular dispositivo'}
        </button>
        <button type="button" className="secondary" disabled={offerState === 'binding'} onClick={dismissOffer}>
          Agora não
        </button>
      </div>
    </div>
  );
}
