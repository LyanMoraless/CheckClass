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
  | 'access_camera_recordings'
  | 'administer_camera_devices'
  | 'manage_security_incidents'
  // RULE-JUST-11.7's dedicated permission for opening a Frente 07
  // absence-justification attachment — by itself only marks a role as
  // ELIGIBLE (typically Professor); RULE-JUST-24's narrow subject-teacher
  // check is enforced server-side on top of this, never inferred here.
  | 'view_absence_justification_attachment';

export const PERMISSIONS: Permission[] = [
  'manage_users',
  'configure_attendance_rules',
  'view_attendance_register',
  'manage_institution_structure',
  'view_camera',
  'view_sector_cameras',
  'fullscreen_camera',
  'access_camera_recordings',
  'administer_camera_devices',
  'manage_security_incidents',
  'view_absence_justification_attachment',
];

export const PERMISSION_LABELS: Record<Permission, string> = {
  manage_users: 'Gerenciar usuários',
  configure_attendance_rules: 'Configurar regras de presença',
  view_attendance_register: 'Ver registro de presença',
  manage_institution_structure: 'Gerenciar estrutura da instituição',
  view_camera: 'Ver câmera',
  view_sector_cameras: 'Ver câmeras do setor',
  fullscreen_camera: 'Câmera em tela cheia',
  access_camera_recordings: 'Acessar gravações de câmera',
  administer_camera_devices: 'Administrar dispositivos de câmera',
  manage_security_incidents: 'Gerenciar incidentes de segurança',
  view_absence_justification_attachment: 'Ver anexo de justificativa de falta',
};
