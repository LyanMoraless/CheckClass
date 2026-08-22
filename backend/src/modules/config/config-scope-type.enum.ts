// attendance_config.scope_type: which level a config row applies to.
// Resolution order (most specific wins) is CLASS_GROUP > COURSE > INSTITUTION.
export enum ConfigScopeType {
  INSTITUTION = 'institution',
  COURSE = 'course',
  CLASS_GROUP = 'class_group',
}
