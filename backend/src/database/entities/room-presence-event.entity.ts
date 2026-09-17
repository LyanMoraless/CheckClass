import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// room-presence's own state (RULE-PRES-04/05/06/07/08) — one row per
// physical tag swipe (ROOM_ENTRY -> 'entry', ROOM_EXIT -> 'exit') already
// resolved to a class_session, consumed post-dedup from
// identification_checkin. Structural precedent: device_binding (Frente
// 12) — a dedicated read primitive, never written to by
// identification_checkin's own pipeline. See AddRoomPresenceEvent
// migration for the full reasoning, including why room_id and the
// RULE-PRES-08 priority-2 exit signals (afastamento prolongado / logout
// explícito) are deliberately NOT columns on this table.
@Entity({ name: 'room_presence_event' })
export class RoomPresenceEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'class_session_id', type: 'uuid' })
  classSessionId: string;

  // entry | exit — denormalized from identification_checkin's own
  // attendance_factor_type (ROOM_ENTRY/ROOM_EXIT) to avoid a join on the
  // isPresentForSession/getSessionProjectedInterval hot path.
  @Column({ type: 'varchar', length: 10 })
  direction: string;

  // The post-dedup identification_checkin row this event was derived from
  // (is_duplicate = false). UNIQUE: reuses the dedup/idempotency the
  // Identification/Deduplication pipeline already resolved upstream —
  // room-presence does not reimplement its own dedup. ON DELETE CASCADE
  // ties this row's lifecycle to the retention purge of its source
  // checkin (see migration).
  @Column({ name: 'identification_checkin_id', type: 'uuid' })
  identificationCheckinId: string;

  // The swipe's own moment — mirrors identification_checkin.checkinAt, the
  // same source of truth PresenceIntervalService already reads today for
  // ROOM_ENTRY/ROOM_EXIT pairing.
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
