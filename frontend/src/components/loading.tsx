import { Loader2 } from 'lucide-react';
import styles from './loading.module.css';

export function Loading({ label = 'Carregando…' }: { label?: string }) {
  return (
    <p className={styles.loading} role="status">
      <Loader2 size={16} className={styles.spinner} />
      {label}
    </p>
  );
}
