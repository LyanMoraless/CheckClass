// Mirrors backend/src/modules/auth/permission.enum.ts — kept in sync manually
// since frontend and backend are separate deployable units with no shared
// package between them.
export type Permission =
  | 'manage_users'
  | 'configure_attendance_rules'
  | 'view_attendance_register'
  | 'manage_institution_structure';

export const PERMISSIONS: Permission[] = [
  'manage_users',
  'configure_attendance_rules',
  'view_attendance_register',
  'manage_institution_structure',
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_users: 'Manage users',
  configure_attendance_rules: 'Configure attendance rules',
  view_attendance_register: 'View attendance register',
  manage_institution_structure: 'Manage institution structure',
};
