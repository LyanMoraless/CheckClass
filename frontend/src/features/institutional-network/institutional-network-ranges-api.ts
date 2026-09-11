import { api } from '../../lib/api-client';

// GAP-10 (RULE-DEV-14): the tenant's allowlist of CIDR ranges the
// institution declares as "inside the institutional network" — see
// "Decisão de tecnologia — Detecção de rede institucional / GAP-10
// (2026-09-11)" in project-knowledge/references/architecture-overview.md.
// Deliberately N rows per tenant, not one
// (institutional-network-range.entity.ts's own header comment: main
// building + annex, a different Wi-Fi for guests vs. the academic
// network), unlike device_binding_config's single row per tenant. With no
// range registered at all, the backend treats every request as OUTSIDE the
// network (safe default, never blocks on missing config) — this feature
// only ever adds/edits/removes rows, it has no "detection result" of its
// own to display.
export interface InstitutionalNetworkRange {
  id: string;
  cidr: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionalNetworkRangeInput {
  cidr: string;
  label?: string;
}

// Read AND write are BOTH Direção/Reitoria-only server-side
// (institutional-network-range.service.ts's assertDirectionAuthority runs
// on every method, including list()/get()) — same "gate the whole
// feature, not just its writes" posture as institutional-machines-api.ts,
// which is why institutional-network-ranges-page.tsx gates its entire
// content on roleContext.isDirection, not just the form.
export async function listInstitutionalNetworkRanges(): Promise<InstitutionalNetworkRange[]> {
  return api.get('/v1/institutional-network/ranges');
}

export async function createInstitutionalNetworkRange(input: InstitutionalNetworkRangeInput): Promise<InstitutionalNetworkRange> {
  return api.post('/v1/institutional-network/ranges', input);
}

// Plain partial edit — same posture as UpdateInstitutionalNetworkRangeDto
// on the backend, though this page always resubmits the full form (same
// convention as updateInstitutionalMachine's call site).
export async function updateInstitutionalNetworkRange(
  id: string,
  input: Partial<InstitutionalNetworkRangeInput>,
): Promise<InstitutionalNetworkRange> {
  return api.patch(`/v1/institutional-network/ranges/${id}`, input);
}

export async function deleteInstitutionalNetworkRange(id: string): Promise<void> {
  await api.delete(`/v1/institutional-network/ranges/${id}`);
}
