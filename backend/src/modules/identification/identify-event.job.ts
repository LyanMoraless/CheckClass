// Shared contract between the Ingestion Gateway (producer) and the
// Identification worker (consumer) — kept out of both modules so neither
// has to import the other just to agree on a queue name/payload shape.
export const IDENTIFY_EVENT_QUEUE = 'identify-event';

export interface IdentifyEventJobData {
  rawEventId: string;
  tenantId: string;
}
