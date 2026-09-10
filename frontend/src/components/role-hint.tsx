import { Lock } from 'lucide-react';
import styles from './permission-hint.module.css';

// Sibling of PermissionHint for the handful of Frente 12 routes that are
// gated by LeadershipScopeService (RULE-DEV-15/RULE-ACC-08: Direção/Reitoria
// authority, verified by role — same mechanism RULE-ATT-12 already uses)
// instead of a Permission enum code. institutional-machines-page.tsx and
// device-binding-config-page.tsx's write side have no dedicated permission
// to point PermissionHint at, so this reuses its exact visual language
// (icon + "Requer …") for a role name instead. Reuses permission-hint's own
// CSS module rather than duplicating the two-line style block.
export function RoleHint({ role = 'Direção/Reitoria' }: { role?: string }) {
  return (
    <small className={styles.hint}>
      <Lock size={12} />
      Requer o papel de {role}.
    </small>
  );
}
