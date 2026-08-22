import { useId, type ReactNode } from 'react';
import styles from './modal.module.css';

interface ModalProps {
  title: string;
  children: ReactNode;
  // No onClose/backdrop-click dismissal by default — callers that need a
  // dismissible modal pass their own close button inside children. The
  // one-time device API key reveal deliberately uses this to make it
  // impossible to dismiss by accident (see devices feature).
}

export function Modal({ title, children }: ModalProps) {
  const titleId = useId();
  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
