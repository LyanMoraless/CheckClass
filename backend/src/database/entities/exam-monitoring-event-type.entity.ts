import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// RULE-EXAM-05: one row per event type ENABLED for a given exam (the
// checkbox list of RULE-EXAM-13) — a per-exam enablement list, not a global
// catalog. exam_session_event keeps its own free-text event_type and does
// not reference this table.
@Entity({ name: 'exam_monitoring_event_type' })
export class ExamMonitoringEventTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_monitoring_config_id', type: 'uuid' })
  examMonitoringConfigId: string;

  // Constrained by CHECK in the database, unlike the audit trail's free
  // text: this is the allow-list of what a client may ask to be monitored.
  // PAGE_BLUR | PAGE_VISIBILITY_CHANGED | NEW_TAB_OR_WINDOW_ATTEMPT |
  // EXTERNAL_NAVIGATION_ATTEMPT | KEYBOARD_RESTRICTION_TRIGGERED |
  // PAGE_RELOAD.
  //
  // NEW_TAB_OR_WINDOW_ATTEMPT covers new tab and new window as a single
  // type (confirmed 2026-09-03). EXTERNAL_APPLICATION_FOCUS is absent on
  // purpose: it needs a desktop agent, out of scope this round.
  @Column({ name: 'event_type', type: 'varchar', length: 40 })
  eventType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
