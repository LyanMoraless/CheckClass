// Shared contract between the Identification worker (producer) and the
// Deduplication worker (consumer) — same pattern as identify-event.job.ts.
export const DEDUPLICATE_CHECKIN_QUEUE = 'deduplicate-checkin';

export interface DeduplicateCheckinJobData {
  checkinId: string;
  tenantId: string;
}
