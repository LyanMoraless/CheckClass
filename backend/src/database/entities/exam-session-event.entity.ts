import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// RULE-EXAM-12's audit trail. Append-only and immutable at the database
// level (grants + a trigger that refuses UPDATE/DELETE for any role, see
// AddExamArea migration): the trail must survive a bug in the very layer
// that writes it, so never attempt to update or delete through this entity.
@Entity({ name: 'exam_session_event' })
export class ExamSessionEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_session_id', type: 'uuid' })
  examSessionId: string;

  // RLS ownership key, guaranteed to match the session's owner by a
  // composite FK (see AddExamArea migration).
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  // Free text on purpose: a new event type must not require a migration,
  // and server-generated events (e.g. EXAM_TIME_EXPIRED) share the column
  // with client-reported ones. The allow-list of what a CLIENT may report
  // is enforced in the application layer, which keeps the two write paths
  // separate.
  @Column({ name: 'event_type', type: 'varchar', length: 60 })
  eventType: string;

  // Whether the violation policy acted on this event. Matters for
  // PAGE_RELOAD: RULE-EXAM-11 always logs a reload, but it only counts as a
  // violation when that event type is enabled for the exam.
  @Column({ name: 'treated_as_violation', type: 'boolean', default: false })
  treatedAsViolation: boolean;

  // Technical details available at detection time (RULE-EXAM-04).
  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  // Written by the server, never accepted from the client (RULE-EXAM-07).
  @CreateDateColumn({ name: 'occurred_at' })
  occurredAt: Date;
}
