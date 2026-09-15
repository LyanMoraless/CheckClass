import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// One row per GPS reading (RULE-PRES-01 login_checkin / RULE-PRES-09
// class_monitoring). See AddRawLocationSignal migration for the full
// reasoning, including the personId attribution CHECK tied to signalType.
@Entity({ name: 'raw_location_signal' })
export class RawLocationSignalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // login_checkin | class_monitoring
  @Column({ name: 'signal_type', type: 'varchar', length: 20 })
  signalType: string;

  // Nullable, same shape as identification_checkin.classSessionId.
  @Column({ name: 'class_session_id', type: 'uuid', nullable: true })
  classSessionId: string | null;

  // Correlates a login_checkin reading to the identification event it
  // gated. Never populated for class_monitoring readings.
  @Column({ name: 'raw_identification_event_id', type: 'uuid', nullable: true })
  rawIdentificationEventId: string | null;

  // Per-signal_type attribution (DB CHECK enforces exactly one nullability
  // per signal_type): NULL for login_checkin (person reachable only via
  // rawIdentificationEventId, never duplicated here); NOT NULL for
  // class_monitoring (the only attribution path on that flow, RULE-PRES-09).
  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId: string | null;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  latitude: number;

  @Column({ type: 'numeric', precision: 9, scale: 6 })
  longitude: number;

  @Column({ name: 'accuracy_meters', type: 'numeric', precision: 7, scale: 2 })
  accuracyMeters: number;

  // Anti-spoofing GPS evidence.
  @Column({ name: 'is_mocked', type: 'boolean', default: false })
  isMocked: boolean;

  // Server clock only (RULE-PRES-02) — never a device-supplied timestamp.
  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'now()' })
  capturedAt: Date;

  // Resend deduplication, tenant-scoped from creation.
  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;
}
