import { UnprocessableEntityException } from '@nestjs/common';
import { IngestionEventType } from './dto/ingestion-event-type.enum';

// Structural validation of the envelope (IngestionEventEnvelopeDto) is
// handled by the global ValidationPipe. This covers the one thing that can't
// be a fixed DTO shape: `data`'s required fields depend on `eventType`
// (RULE-ATT-01/06/13 — the factor list is extensible, so CUSTOM stays loose).
//
// Security review finding: checking required fields are PRESENT isn't
// enough — `data` is an untyped Record, so `ValidationPipe`'s whitelist has
// no effect inside it, and nothing stopped extra keys riding along
// unfiltered into raw_payload. That's the exact hole a raw image/biometric
// template could ride through on a FACIAL_CHECKIN despite the explicit
// privacy decision (2026-08-21) forbidding it. Every non-CUSTOM event type
// now rejects any key it doesn't expect; CUSTOM stays open-ended by design.
export function validateEventData(eventType: IngestionEventType, data: Record<string, unknown>): void {
  switch (eventType) {
    case IngestionEventType.TAG_CHECKIN:
    case IngestionEventType.ROOM_ENTRY:
    case IngestionEventType.ROOM_EXIT:
      requireString(data, 'tagCode', eventType);
      rejectUnknownKeys(data, ['tagCode'], eventType);
      return;
    case IngestionEventType.FACIAL_CHECKIN:
      // Privacy decision (2026-08-21): never a raw image/biometric template —
      // only a local match reference resolved on-device and its confidence.
      requireString(data, 'matchReference', eventType);
      requireNumber(data, 'confidence', eventType);
      rejectUnknownKeys(data, ['matchReference', 'confidence'], eventType);
      return;
    case IngestionEventType.CAMERA_COUNT:
      requireNumber(data, 'count', eventType);
      rejectUnknownKeys(data, ['count'], eventType);
      return;
    case IngestionEventType.CUSTOM:
      // Deliberately not allowlisted: RULE-ATT-13 lets an institution define
      // its own custom factor data shape beyond factorCode.
      requireString(data, 'factorCode', eventType);
      return;
  }
}

function requireString(data: Record<string, unknown>, field: string, eventType: IngestionEventType): void {
  if (typeof data[field] !== 'string' || data[field] === '') {
    throw new UnprocessableEntityException(`data.${field} (non-empty string) is required for event_type ${eventType}`);
  }
}

function requireNumber(data: Record<string, unknown>, field: string, eventType: IngestionEventType): void {
  if (typeof data[field] !== 'number' || Number.isNaN(data[field])) {
    throw new UnprocessableEntityException(`data.${field} (number) is required for event_type ${eventType}`);
  }
}

function rejectUnknownKeys(data: Record<string, unknown>, allowedKeys: string[], eventType: IngestionEventType): void {
  const unknownKeys = Object.keys(data).filter((key) => !allowedKeys.includes(key));
  if (unknownKeys.length > 0) {
    throw new UnprocessableEntityException(
      `data has unexpected field(s) for event_type ${eventType}: ${unknownKeys.join(', ')} (allowed: ${allowedKeys.join(', ')})`,
    );
  }
}
