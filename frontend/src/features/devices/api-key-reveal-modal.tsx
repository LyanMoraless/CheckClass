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
    <Modal title="Device API key — shown only once">
      <p>
        This key authenticates the device against the ingestion API. It cannot be retrieved again after you close this
        dialog — the backend only stores its hash.
      </p>
      <pre style={{ background: '#f4f4f4', padding: '0.75rem', overflowWrap: 'break-word', whiteSpace: 'pre-wrap' }}>
        {apiKey}
      </pre>
      <button type="button" onClick={handleCopy}>
        {copied ? 'Copied!' : 'Copy to clipboard'}
      </button>
      <p>
        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '0.4rem', maxWidth: 'none' }}>
          <input type="checkbox" checked={confirmedCopy} onChange={(event) => setConfirmedCopy(event.target.checked)} />
          I have copied this key somewhere safe
        </label>
      </p>
      <button type="button" onClick={onConfirmed} disabled={!confirmedCopy}>
        Done — close this dialog
      </button>
    </Modal>
  );
}
