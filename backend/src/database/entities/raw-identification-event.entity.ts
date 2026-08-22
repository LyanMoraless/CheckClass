import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'raw_identification_event' })
export class RawIdentificationEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // NULL means app-originated (AppCheckinService) — a person-JWT-authenticated
  // submission has no device at all, unlike every other event type on this
  // table, which always comes through DeviceAuthGuard with a real device_id
  // (see AllowNullDeviceIdForAppCheckin migration). The DB enforces that this
  // is exactly equivalent to event_type = 'APP_CHECKIN' — never NULL for any
  // other event_type, never non-NULL for APP_CHECKIN — via a CHECK constraint
  // (see AddRawIdentificationEventOriginCheckConstraint), so a technical
  // administrator auditing raw events (RULE-RET-04) never has to infer origin
  // from device_id alone.
  @Column({ name: 'device_id', type: 'uuid', nullable: true })
  deviceId: string | null;

  // TAG_CHECKIN | FACIAL_CHECKIN | ROOM_ENTRY | ROOM_EXIT | CAMERA_COUNT | CUSTOM | APP_CHECKIN
  @Column({ name: 'event_type', type: 'varchar', length: 30 })
  eventType: string;

  // Exact-resend deduplication (RULE-ATT-10, first-copy-wins).
  @Index({ unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;

  // captured_at currently lives only inside raw_payload; promoting it to an
  // indexed column is a pending, non-blocking decision (see pending-decisions.md).
  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
