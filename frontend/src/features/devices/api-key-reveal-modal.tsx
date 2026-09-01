import { useState } from 'react';
import { Modal } from '../../components/modal';

interface ApiKeyRevealModalProps {
  apiKey: string;
  onConfirmed: () => void;
}

// RegisterDeviceService only ever returns this once — it's never
// retrievable again after this render. No backdrop-click or escape-key
// dismissal on purpose: the admin must tick the explicit confirmation
// checkbox to prove they copied it before this can close.
export function ApiKeyRevealModal({ apiKey, onConfirmed }: ApiKeyRevealModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmedCopy, setConfirmedCopy] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey);
    setCopied(true);
  }

  return (
    <Modal title="Chave de API do dispositivo — exibida apenas uma vez">
      <p>
        Esta chave autentica o dispositivo perante a API de ingestão. Ela não pode ser recuperada novamente depois que
        você fechar esta janela — o backend armazena apenas o seu hash.
      </p>
      <pre style={{ background: '#f4f4f4', padding: '0.75rem', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
        {apiKey}
      </pre>
      <button type="button" onClick={handleCopy}>
        {copied ? 'Copiado!' : 'Copiar para a área de transferência'}
      </button>
      <p>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', maxWidth: 'none' }}>
          <input type="checkbox" checked={confirmedCopy} onChange={(event) => setConfirmedCopy(event.target.checked)} />
          Copiei esta chave em um local seguro
        </label>
      </p>
      <button type="button" onClick={onConfirmed} disabled={!confirmedCopy}>
        Concluído — fechar esta janela
      </button>
    </Modal>
  );
}
