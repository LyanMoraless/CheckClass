import { IsEnum, IsISO8601, IsNotEmpty, IsObject, IsString, IsUUID, MaxLength } from 'class-validator';
import { SecurityIngestionEventType } from '../security-ingestion-event-type.enum';

// Envelope shape approved in architecture-overview.md ("Decisão de
// tecnologia — Segurança de Intrusão, primeira rodada", item 3):
// `{ idempotencyKey, eventType, capturedAt, areaId, data }`. tenantId/deviceId
// are deliberately absent — resolved by the Gateway from the device's auth
// credential (DeviceAuthGuard), same anti-spoofing idiom as
// IngestionEventEnvelopeDto.
//
// `data` is required but, unlike IngestionEventEnvelopeDto's, NOT constrained
// to be non-empty: IR_BARRIER_CROSSING is anonymous by nature and may carry
// no identity data at all (an empty object) — validateSecurityEventData
// enforces the per-eventType shape (AREA_READER_SCAN requires `tagCode`;
// IR_BARRIER_CROSSING rejects any key at all).
export class SecurityIngestionEventEnvelopeDto {
  @IsString()
  @IsNotEmpty()
  // Matches raw_security_event.idempotency_key's varchar(255).
  @MaxLength(255)
  idempotencyKey: string;

  @IsEnum(SecurityIngestionEventType)
  eventType: SecurityIngestionEventType;

  @IsISO8601()
  capturedAt: string;

  @IsUUID()
  areaId: string;

  @IsObject()
  data: Record<string, unknown>;
}
