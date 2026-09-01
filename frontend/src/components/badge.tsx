import styles from './badge.module.css';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface BadgeProps {
  label: string;
  tone: BadgeTone;
}

// Small status pill — the single place status vocabulary (enrollment
// status, session status, incident severity, etc.) gets a consistent color
// treatment across every screen, instead of each page inventing its own.
export function Badge({ label, tone }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{label}</span>;
}
