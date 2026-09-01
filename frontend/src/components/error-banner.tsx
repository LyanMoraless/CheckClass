import { AlertCircle } from 'lucide-react';
import styles from './error-banner.module.css';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p className={styles.banner} role="alert">
      <AlertCircle size={16} className={styles.icon} />
      {message}
    </p>
  );
}
