import { ApiError, apiClient } from '../../lib/api-client';

// Mirrors AppCheckinResult (app-checkin.service.ts) exactly.
export interface CheckInResult {
  eventId: string;
  created: boolean;
}

// POST /v1/app-checkin (app-checkin.controller.ts): person-JWT-authenticated, no roomId/
// capturedAt — RULE-ATT-06's confirmed note means the server resolves the class session
// purely from the caller's active enrollments + the server's own clock at receipt time. The
// DTO intentionally does not accept a client-supplied timestamp at all (see
// AppCheckinDto) — never attempt to add one here.
export async function submitCheckIn(idempotencyKey: string): Promise<CheckInResult> {
  return apiClient.post<CheckInResult>('/v1/app-checkin', { idempotencyKey });
}

// Gap — "Overlapping simultaneous class sessions in app check-in" (pending-decisions.md):
// unconfirmed business behavior, so the backend deliberately 422s instead of guessing
// (app-checkin.service.ts). Both 422 causes below are expected, named outcomes — not bugs —
// and need distinct copy, not a generic "something went wrong". The API has no
// machine-readable error code for either today, so this matches on the backend's literal
// message text; if the backend ever adds a proper error code, this should switch to that
// instead of string matching.
const NO_ACTIVE_SESSION_MARKER = 'No class session is currently in progress';
const AMBIGUOUS_SESSION_MARKER = 'More than one of your enrolled class sessions is in progress';

export type CheckInErrorKind = 'no-active-session' | 'ambiguous-session' | 'other';

export interface DescribedCheckInError {
  kind: CheckInErrorKind;
  message: string;
}

export function describeCheckInError(error: unknown): DescribedCheckInError {
  if (error instanceof ApiError && error.statusCode === 422) {
    if (error.message.includes(NO_ACTIVE_SESSION_MARKER)) {
      return {
        kind: 'no-active-session',
        message: "You don't have a class session in progress right now — check-in is only available during a scheduled class.",
      };
    }
    if (error.message.includes(AMBIGUOUS_SESSION_MARKER)) {
      return {
        kind: 'ambiguous-session',
        message:
          'You have two overlapping class sessions in progress at the same time, so the app cannot tell which one this check-in is for. Please let your institution know.',
      };
    }
  }
  return { kind: 'other', message: error instanceof Error ? error.message : 'Something went wrong' };
}
