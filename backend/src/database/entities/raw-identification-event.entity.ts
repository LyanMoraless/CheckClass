import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'raw_identification_event' })
export class RawIdentificationEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId: string;

  // TAG_CHECKIN | FACIAL_CHECKIN | ROOM_ENTRY | ROOM_EXIT | CAMERA_COUNT | CUSTOM
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
