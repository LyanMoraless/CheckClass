// Initial permission set confirmed 2026-08-22. Extensible later — an
// institution's groups reference these by code (permission_group_permission
// .permission_code), so adding a new permission is just adding a new enum
// value, no schema change needed.
export enum Permission {
  MANAGE_USERS = 'manage_users',
  CONFIGURE_ATTENDANCE_RULES = 'configure_attendance_rules',
  VIEW_ATTENDANCE_REGISTER = 'view_attendance_register',
  MANAGE_INSTITUTION_STRUCTURE = 'manage_institution_structure',

  // RULE-ACC-07's five camera-permission codes, confirmed 2026-08-23 — five
  // independent codes, no dependency between them (e.g. ACCESS_CAMERA_RECORDINGS
  // does NOT require VIEW_CAMERA to also be granted).
  VIEW_CAMERA = 'view_camera',
  VIEW_SECTOR_CAMERAS = 'view_sector_cameras',
  FULLSCREEN_CAMERA = 'fullscreen_camera',
  ACCESS_CAMERA_RECORDINGS = 'access_camera_recordings',
  ADMINISTER_CAMERA_DEVICES = 'administer_camera_devices',

  // RULE-SEC-07's closure authorization: any "Equipe de segurança" member,
  // flat (no leadership hierarchy) — confirmed 2026-08-23.
  MANAGE_SECURITY_INCIDENTS = 'manage_security_incidents',

  // RULE-JUST-11.7's dedicated, new permission for opening a Frente 07
  // absence-justification attachment. By itself this code only marks a role
  // as ELIGIBLE (typically granted to Professor) — it is NOT sufficient
  // authorization: RULE-JUST-24 additionally requires the narrow
  // class_group_subject_teacher check (this professor teaches THIS matéria
  // in THIS turma, no leadership-chain shortcut), re-verified server-side on
  // every open, never cached, never a public/permanent URL (RULE-JUST-11.5).
  VIEW_ABSENCE_JUSTIFICATION_ATTACHMENT = 'view_absence_justification_attachment',
}
