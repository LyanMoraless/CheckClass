import { IsEnum, IsISO8601, IsNotEmpty, IsNotEmptyObject, IsObject, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { IngestionEventType } from './ingestion-event-type.enum';

// tenant_id and device_id are deliberately absent — they're resolved by the
// Gateway from the device's auth credential, never trusted from the body
// (approved 2026-08-21, architecture-overview.md).
export class IngestionEventEnvelopeDto {
  @IsString()
  @IsNotEmpty()
  // Matches raw_identification_event.idempotency_key's varchar(255) — without
  // this, an oversized value skips the intended 422 semantic-validation path
  // and surfaces as a raw, unhandled Postgres error (500) instead.
  @MaxLength(255)
  idempotencyKey: string;

  @IsEnum(IngestionEventType)
  eventType: IngestionEventType;

  @IsISO8601()
  capturedAt: string;

  @IsUUID()
  @IsOptional()
  roomId?: string;

  @IsObject()
  @IsNotEmptyObject()
  data: Record<string, unknown>;
}
