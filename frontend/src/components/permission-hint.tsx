import { Lock } from 'lucide-react';
import { PERMISSION_LABELS, type Permission } from '../types/permission';
import styles from './permission-hint.module.css';

// Shown next to an action the logged-in person can't currently perform, so
// disabled controls always come with a reason instead of just not working.
// Accepts either a single permission or an OR-set (e.g. the camera list,
// which the backend gates on view_camera OR view_sector_cameras) — most
// callers still pass a single permission, unaffected by this.
export function PermissionHint({ permission }: { permission: Permission | Permission[] }) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const labels = permissions.map((p) => `"${PERMISSION_LABELS[p]}"`).join(' ou ');
  return (
    <small className={styles.hint}>
      <Lock size={12} />
      Requer {permissions.length > 1 ? 'uma das permissões ' : 'a permissão '}
      {labels}.
    </small>
  );
}
