import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'identification_checkin' })
export class IdentificationCheckinEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'raw_identification_event_id', type: 'uuid' })
  rawIdentificationEventId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'class_session_id', type: 'uuid', nullable: true })
  classSessionId: string | null;

  @Column({ name: 'attendance_factor_type_id', type: 'uuid' })
  attendanceFactorTypeId: string;

  @Column({ name: 'checkin_at', type: 'timestamptz' })
  checkinAt: Date;

  // Set by the Deduplication Service (RULE-ATT-10/RULE-RET-03). A duplicate
  // row is kept, never deleted, and points at the canonical checkin it
  // duplicates — the Motor de Regras only ever reads is_duplicate = false.
  @Column({ name: 'is_duplicate', type: 'boolean', default: false })
  isDuplicate: boolean;

  @Column({ name: 'duplicate_of_checkin_id', type: 'uuid', nullable: true })
  duplicateOfCheckinId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
