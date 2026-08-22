import styles from './error-banner.module.css';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <p className={styles.banner} role="alert">
      {message}
    </p>
  );
}
