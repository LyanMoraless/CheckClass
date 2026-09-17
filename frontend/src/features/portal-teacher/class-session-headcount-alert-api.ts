import { api } from '../../lib/api-client';

// GET /v1/me/class-sessions/:classSessionId/headcount-alert — RULE-PRES-10/11
// (Bloco 4 — Contagem por câmera como cruzamento, Fluxo de Chamada
// Redesenhado). Mirrors ClassroomHeadcountReconciliationResult
// (backend/src/modules/classroom-headcount-reconciliation/
// classroom-headcount-reconciliation.service.ts) exactly — the HTTP response
// carries that interface verbatim via MeClassSessionHeadcountAlertService,
// same "mirror the backend interface" idiom every other *-api.ts file in
// this app already follows (e.g. ActiveWarningEntry).
//
// Read-only cross-check, never a decision: RULE-PRES-10 keeps the actual
// presença call manual (a normal chamada made by the professor) — alertActive
// only ever INFORMS. There is deliberately no "resolver"/"confirmar
// presença" action anywhere near this client.
export interface ClassroomHeadcountWindow {
  // The camera reading's own capture instant (not "when this response was
  // computed") — this window's identity, see the backend service's own
  // comment on ClassroomHeadcountWindow.capturedAt.
  capturedAt: string;
  cameraCount: number;
  appCheckinCount: number;
  roomPresenceCount: number;
  maxDivergence: number;
}

export interface ClassroomHeadcountAlert {
  classSessionId: string;
  // false whenever the session isn't running right now — a normal state
  // (before start / after end), never an error. windows is always empty in
  // that case.
  inProgress: boolean;
  roomId: string | null;
  // Most recent windows examined, most recent first — length 0 (no camera
  // reading yet), 1 (one reading, RULE-PRES-11's "duas contagens
  // consecutivas" not confirmable yet) or 2 (never more).
  windows: ClassroomHeadcountWindow[];
  // RULE-PRES-11: true only when both of the two most recent windows
  // reached the divergence threshold.
  alertActive: boolean;
}

export async function getClassSessionHeadcountAlert(classSessionId: string): Promise<ClassroomHeadcountAlert> {
  return api.get(`/v1/me/class-sessions/${classSessionId}/headcount-alert`);
}
