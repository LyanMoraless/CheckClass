// RULE-DEV-04's closed set of four statuses for an institutional machine's
// inventory row. Matches institutional_machine_status_check in the
// AddDeviceBinding migration exactly.
export enum InstitutionalMachineStatus {
  ACTIVE = 'active',
  MAINTENANCE = 'maintenance',
  DECOMMISSIONED = 'decommissioned',
  STOLEN = 'stolen',
}
