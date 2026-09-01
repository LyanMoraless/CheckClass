import styles from './info-banner.module.css';

// Neutral counterpart to ErrorBanner — for messages that aren't errors (e.g.
// "you were redirected here because X already happened"), so they aren't
// styled/announced like a failure.
export function InfoBanner({ message }: { message: string }) {
  return (
    <p className={styles.banner} role="status">
      {message}
    </p>
  );
}
