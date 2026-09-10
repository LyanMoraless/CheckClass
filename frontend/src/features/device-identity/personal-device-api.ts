import { api } from '../../lib/api-client';

// RULE-DEV-02/17/18 — BYOD, self-service. Deliberately enxuto (no
// RULE-DEV-04 inventory fields — those only apply to institutional machines).
export interface PersonalDevice {
  id: string;
  personId: string;
  label: string | null;
  revokedAt: string | null;
  revokedByPersonId: string | null;
  createdAt: string;
  updatedAt: string;
}

// RULE-DEV-02: any authenticated person, self-service only — personId is
// always resolved server-side from the JWT, never sent here. RULE-DEV-17:
// backend 409s if this person already has an active personal device.
export async function registerPersonalDevice(label?: string): Promise<PersonalDevice> {
  return api.post('/v1/device-identity/personal-devices', label ? { label } : {});
}

// Backend returns null (not 404) when the caller has no active personal
// device yet — a plain "not registered yet" state, not an error.
export async function getMyPersonalDevice(): Promise<PersonalDevice | null> {
  return api.get('/v1/device-identity/personal-devices/me');
}

// RULE-DEV-18: the owner themself OR the inventory administrator
// (Direção/Reitoria) may call this — authorized server-side, not by this
// client. Idempotent on the backend (already-revoked is a silent no-op).
export async function revokePersonalDevice(id: string): Promise<{ id: string; status: 'revoked' }> {
  return api.post(`/v1/device-identity/personal-devices/${id}/revoke`);
}
