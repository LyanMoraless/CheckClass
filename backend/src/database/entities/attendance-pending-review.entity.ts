import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'attendance_pending_review' })
export class AttendancePendingReviewEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_session_id', type: 'uuid' })
  classSessionId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  // missing_factor (RULE-ATT-07) | missing_exit (RULE-ATT-09)
  @Column({ type: 'varchar', length: 30 })
  reason: string;

  @Column({ name: 'resolved_by_person_id', type: 'uuid', nullable: true })
  resolvedByPersonId: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  // No expiration/TTL column, by design — RULE-ATT-11: a pending review never
  // auto-resolves with the passage of time.
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
