import { api } from '../../lib/api-client';

// Mirrors backend/src/modules/device-identity/institutional-machine-status.enum.ts
// (RULE-DEV-04's closed set of four statuses) — kept in sync manually, same
// posture as types/permission.ts.
export type InstitutionalMachineStatus = 'active' | 'maintenance' | 'decommissioned' | 'stolen';

// RULE-DEV-04's four required field groups: (1) assetTag/serialNumber, (2)
// roomId/status, (3) brand/model/processor/memoryDescription/operatingSystem,
// (4) courseId (RULE-DEV-05: inventory metadata only, never authorization).
export interface InstitutionalMachine {
  id: string;
  assetTag: string;
  serialNumber: string;
  roomId: string;
  status: InstitutionalMachineStatus;
  brand: string;
  model: string;
  processor: string;
  memoryDescription: string;
  operatingSystem: string;
  courseId: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionalMachineInput {
  assetTag: string;
  serialNumber: string;
  roomId: string;
  status: InstitutionalMachineStatus;
  brand: string;
  model: string;
  processor: string;
  memoryDescription: string;
  operatingSystem: string;
  courseId: string;
}

// Write side (create/update/dar baixa) is Direção/Reitoria-only, checked
// server-side via LeadershipScopeService (RULE-DEV-15) — a 403 surfaces
// through errorMessage()/ErrorBanner like any other mutation error. list()/
// get() are ALSO gated the same way server-side (institutional-machine.service.ts's
// "default to denying access" note) — this whole feature is Direção/Reitoria
// only, not just its writes, which is why institutional-machines-page.tsx
// gates its entire content on roleContext.isDirection, not just the form.
export async function listInstitutionalMachines(): Promise<InstitutionalMachine[]> {
  return api.get('/v1/device-identity/institutional-machines');
}

export async function createInstitutionalMachine(input: InstitutionalMachineInput): Promise<InstitutionalMachine> {
  return api.post('/v1/device-identity/institutional-machines', input);
}

// Covers both "editar" and "dar baixa" (RULE-DEV-15) — baixa is just this
// same partial update with status set to maintenance/decommissioned/stolen,
// not a separate action/endpoint.
export async function updateInstitutionalMachine(
  id: string,
  input: Partial<InstitutionalMachineInput>,
): Promise<InstitutionalMachine> {
  return api.patch(`/v1/device-identity/institutional-machines/${id}`, input);
}
