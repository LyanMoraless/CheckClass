import { UnprocessableEntityException } from '@nestjs/common';
import { SecurityIngestionEventType } from './security-ingestion-event-type.enum';

// Structural validation of the envelope (SecurityIngestionEventEnvelopeDto)
// is handled by the global ValidationPipe. This covers what can't be a fixed
// DTO shape: `data`'s required fields depend on `eventType` — same pattern
// and same security-review reasoning as ingestion/event-data.validator.ts
// (checking required fields are PRESENT isn't enough; `data` is an untyped
// Record, so the whitelist has no effect inside it — every key is checked
// explicitly, including rejecting all of them for IR_BARRIER_CROSSING).
export function validateSecurityEventData(eventType: SecurityIngestionEventType, data: Record<string, unknown>): void {
  switch (eventType) {
    case SecurityIngestionEventType.AREA_READER_SCAN:
      requireString(data, 'tagCode', eventType);
      rejectUnknownKeys(data, ['tagCode'], eventType);
      return;
    case SecurityIngestionEventType.IR_BARRIER_CROSSING:
      // Anonymous by nature (Tech Decision item 3) — a beam break carries no
      // identity data at all, so no key is allowed here.
      rejectUnknownKeys(data, [], eventType);
      return;
  }
}

function requireString(data: Record<string, unknown>, field: string, eventType: SecurityIngestionEventType): void {
  if (typeof data[field] !== 'string' || data[field] === '') {
    throw new UnprocessableEntityException(`data.${field} (non-empty string) is required for event_type ${eventType}`);
  }
}

function rejectUnknownKeys(data: Record<string, unknown>, allowedKeys: string[], eventType: SecurityIngestionEventType): void {
  const unknownKeys = Object.keys(data).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new UnprocessableEntityException(
      `data has unexpected field(s) for event_type ${eventType}: ${unknownKeys.join(', ')} (allowed: ${allowedKeys.join(', ') || 'none'})`,
    );
  }
}
