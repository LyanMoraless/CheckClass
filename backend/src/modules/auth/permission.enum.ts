// Initial permission set confirmed 2026-08-22. Extensible later — an
// institution's groups reference these by code (permission_group_permission
// .permission_code), so adding a new permission is just adding a new enum
// value, no schema change needed.
export enum Permission {
  MANAGE_USERS = 'manage_users',
  CONFIGURE_ATTENDANCE_RULES = 'configure_attendance_rules',
  VIEW_ATTENDANCE_REGISTER = 'view_attendance_register',
  MANAGE_INSTITUTION_STRUCTURE = 'manage_institution_structure',
}
