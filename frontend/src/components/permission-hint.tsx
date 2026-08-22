import { PERMISSION_LABELS, type Permission } from '../types/permission';

// Shown next to an action the logged-in person can't currently perform, so
// disabled controls always come with a reason instead of just not working.
export function PermissionHint({ permission }: { permission: Permission }) {
  return <small>Requires the "{PERMISSION_LABELS[permission]}" permission.</small>;
}
