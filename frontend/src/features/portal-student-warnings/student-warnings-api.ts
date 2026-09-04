import { api } from '../../lib/api-client';

// GET /v1/me/warnings — RULE-FREQ-04 items 2/4, self-scoped like every other
// /v1/me/* route (me.controller.ts, RULE-ATT-15's "is this my own data"
// idiom). Mirrors FrequencyWarningReadService's ActiveWarningEntry exactly.
export interface ActiveWarningEntry {
  id: string;
  classGroupId: string;
  classGroupName: string;
  subjectId: string;
  subjectName: string;
  // The backend's own interface keeps this as a raw string on purpose (it
  // doesn't want to duplicate the vocabulary AttendanceWarningService and the
  // DB CHECK already own). The frontend has the opposite need — this drives
  // an exhaustive switch over exactly two visually-distinct card treatments
  // (RULE-FREQ-07) — so it's narrowed here, same idiom as ConfigScopeType/
  // PostToleranceBehavior in attendance-config-api.ts.
  warningType: 'approaching_minimum' | 'below_minimum';
  warningTypeSince: string;
  // Rounded integer the system actually compared against the minimum
  // (frequency-warning-read.service.ts note 1) — never the raw ratio.
  frequencyPercentage: number;
  presentCount: number;
  consideredCount: number;
  // Explainability only (what was in force when this row was last written) —
  // never a live configuration source. See attendance-frequency-warning.entity.ts.
  minPercentageApplied: number;
  // Date-only strings ("YYYY-MM-DD"), rendered by Postgres to_char on the
  // backend precisely so no timezone-shift bug can move these — see decision
  // 3 in frequency-warning-read.service.ts. Never parse these with `new
  // Date(...)` for anything but display of the date parts themselves.
  periodStartDate: string;
  periodEndDate: string;
  // Null means this is the FIRST time this warning has ever been shown to the
  // student (RULE-FREQ-04 item 1) — the value here is from BEFORE this same
  // request stamped it, so the client is the only place that can still tell
  // "first view" from "already seen".
  seenAt: string | null;
}

export async function listMyWarnings(): Promise<ActiveWarningEntry[]> {
  return api.get('/v1/me/warnings');
}
