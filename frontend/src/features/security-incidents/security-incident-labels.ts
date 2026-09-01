import type { BadgeTone } from '../../components/badge';
import type { SecurityIncidentOutcome, SecurityIncidentStatus } from './security-incidents-api';

// Presentation-only label/tone mapping for the status and outcome enums the
// backend already defines (SecurityIncidentStatus / SecurityIncidentOutcome).
// Shared between the incident list and detail pages so the visual vocabulary
// (danger = open/active alert, success = resolved, neutral = closed/false
// positive) stays consistent across both screens instead of being redefined
// twice.
export const SECURITY_INCIDENT_STATUS_BADGE: Record<SecurityIncidentStatus, { label: string; tone: BadgeTone }> = {
  open: { label: 'Aberto', tone: 'danger' },
  closed: { label: 'Fechado', tone: 'neutral' },
};

export const SECURITY_INCIDENT_OUTCOME_BADGE: Record<SecurityIncidentOutcome, { label: string; tone: BadgeTone }> = {
  resolved: { label: 'Resolvido', tone: 'success' },
  false_positive: { label: 'Falso positivo', tone: 'neutral' },
};
