// Initial permission set confirmed 2026-08-22. Extensible later — an
// institution's groups reference these by code (permission_group_permission
// .permission_code), so adding a new permission is just adding a new enum
// value, no schema change needed.
export enum Permission {
  MANAGE_USERS = 'manage_users',
  CONFIGURE_ATTENDANCE_RULES = 'configure_attendance_rules',
  VIEW_ATTENDANCE_REGISTER = 'view_attendance_register',
  MANAGE_INSTITUTION_STRUCTURE = 'manage_institution_structure',

  // RULE-ACC-07's six camera-permission codes, confirmed 2026-08-23 — six
  // independent codes, no dependency between them (e.g. FOLLOW_CAMERA_EVENTS
  // does NOT require VIEW_CAMERA to also be granted).
  VIEW_CAMERA = 'view_camera',
  VIEW_SECTOR_CAMERAS = 'view_sector_cameras',
  FULLSCREEN_CAMERA = 'fullscreen_camera',
  FOLLOW_CAMERA_EVENTS = 'follow_camera_events',
  ACCESS_CAMERA_RECORDINGS = 'access_camera_recordings',
  ADMINISTER_CAMERA_DEVICES = 'administer_camera_devices',
}
