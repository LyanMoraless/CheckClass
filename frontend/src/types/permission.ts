// Mirrors backend/src/modules/auth/permission.enum.ts — kept in sync manually
// since frontend and backend are separate deployable units with no shared
// package between them.
export type Permission =
  | 'manage_users'
  | 'configure_attendance_rules'
  | 'view_attendance_register'
  | 'manage_institution_structure'
  | 'view_camera'
  | 'view_sector_cameras'
  | 'fullscreen_camera'
  | 'follow_camera_events'
  | 'access_camera_recordings'
  | 'administer_camera_devices'
  | 'manage_security_incidents';

export const PERMISSIONS: Permission[] = [
  'manage_users',
  'configure_attendance_rules',
  'view_attendance_register',
  'manage_institution_structure',
  'view_camera',
  'view_sector_cameras',
  'fullscreen_camera',
  'follow_camera_events',
  'access_camera_recordings',
  'administer_camera_devices',
  'manage_security_incidents',
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_users: 'Manage users',
  configure_attendance_rules: 'Configure attendance rules',
  view_attendance_register: 'View attendance register',
  manage_institution_structure: 'Manage institution structure',
  view_camera: 'View camera',
  view_sector_cameras: 'View sector cameras',
  fullscreen_camera: 'Fullscreen camera',
  follow_camera_events: 'Follow camera events',
  access_camera_recordings: 'Access camera recordings',
  administer_camera_devices: 'Administer camera devices',
  manage_security_incidents: 'Manage security incidents',
};
