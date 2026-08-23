import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Gateway de Ingestão de Sinais de Segurança's raw event table — deliberately
// separate from raw_identification_event (attendance pipeline). See
// AddRawSecurityEvent migration for the full reasoning, including why
// device_id/area_id/captured_at are NOT NULL here unlike their
// raw_identification_event counterparts.
@Entity({ name: 'raw_security_event' })
export class RawSecurityEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId: string;

  // IR_BARRIER_CROSSING | AREA_READER_SCAN
  @Column({ name: 'event_type', type: 'varchar', length: 30 })
  eventType: string;

  @Column({ name: 'area_id', type: 'uuid' })
  areaId: string;

  @Column({ name: 'captured_at', type: 'timestamptz' })
  capturedAt: Date;

  @Column({ name: 'idempotency_key', type: 'varchar', length: 255 })
  idempotencyKey: string;

  // { tagCode } for AREA_READER_SCAN; IR_BARRIER_CROSSING may carry no
  // identity data at all (a beam break is anonymous by nature).
  @Column({ name: 'raw_payload', type: 'jsonb' })
  rawPayload: Record<string, unknown>;

  @CreateDateColumn({ name: 'received_at' })
  receivedAt: Date;
}
