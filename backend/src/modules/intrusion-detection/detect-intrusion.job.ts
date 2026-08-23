// Shared contract between the Gateway de Ingestão de Sinais de Segurança
// (producer) and the Motor de Detecção de Intrusão worker (consumer) — same
// pattern as identify-event.job.ts, kept out of both modules so neither has
// to import the other just to agree on a queue name/payload shape.
export const DETECT_INTRUSION_QUEUE = 'detect-intrusion';

export interface DetectIntrusionJobData {
  rawEventId: string;
  tenantId: string;
}
