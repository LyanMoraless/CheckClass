import { api, buildQuery } from '../../lib/api-client';

export type SecurityIncidentStatus = 'open' | 'closed';
export type SecurityIncidentOutcome = 'resolved' | 'false_positive';

export interface SecurityIncident {
  id: string;
  tenantId: string;
  personId: string | null;
  wristbandCategoryId: string | null;
  currentAreaId: string | null;
  status: SecurityIncidentStatus;
  openedAt: string;
  outcome: SecurityIncidentOutcome | null;
  resolutionNote: string | null;
  closedByPersonId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// RULE-SEC-02's movement trail: one entry per correlated detection appended
// to the incident, ordered oldest-first by the backend (detectedAt ASC).
export interface SecurityIncidentLocationEntry {
  id: string;
  tenantId: string;
  intrusionIncidentId: string;
  rawSecurityEventId: string;
  areaId: string;
  detectedAt: string;
  createdAt: string;
}

export interface SecurityIncidentDetail {
  incident: SecurityIncident;
  locationHistory: SecurityIncidentLocationEntry[];
  // RULE-SEC-03's camera auto-follow: the camera (if any) whose area matches
  // the incident's current estimated area — metadata only, never a stream.
  suggestedCameraId: string | null;
}

export interface CloseSecurityIncidentInput {
  outcome: SecurityIncidentOutcome;
  note: string;
}

export async function listSecurityIncidents(status?: SecurityIncidentStatus): Promise<SecurityIncident[]> {
  return api.get(`/v1/security-incidents${buildQuery({ status })}`);
}

export async function getSecurityIncident(incidentId: string): Promise<SecurityIncidentDetail> {
  return api.get(`/v1/security-incidents/${incidentId}`);
}

export async function closeSecurityIncident(
  incidentId: string,
  input: CloseSecurityIncidentInput,
): Promise<{ incidentId: string; outcome: SecurityIncidentOutcome }> {
  return api.post(`/v1/security-incidents/${incidentId}/close`, input);
}
