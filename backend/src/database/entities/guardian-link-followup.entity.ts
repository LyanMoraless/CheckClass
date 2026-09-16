import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Traceable follow-up item opened by RetroactiveMinorConsentGuardService
// whenever it automatically suspends a location consent for retroactive
// minority (RULE-GRD-07/RULE-PRES-14) — replaces the previous
// logger.warn-only trigger. See AddGuardianLinkFollowup migration for the
// full reasoning, including the resolution mutual-exclusivity CHECK and
// the column-level UPDATE grant (only the 4 resolution columns).
@Entity({ name: 'guardian_link_followup' })
export class GuardianLinkFollowupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // The minor whose location consent was suspended.
  @Column({ name: 'subject_person_id', type: 'uuid' })
  subjectPersonId: string;

  // Closed vocabulary (DB CHECK), one value today — designed for
  // RULE-FACE-09 to reuse this table with a second value later.
  @Column({ type: 'varchar', length: 100 })
  reason: string;

  // Typed FK to the location_consent_decision row (decision = 'revoked')
  // that originated this item.
  @Column({ name: 'related_location_consent_decision_id', type: 'uuid', nullable: true })
  relatedLocationConsentDecisionId: string | null;

  // Secretaria staff member whose in-person confirmation of
  // date_of_birth triggered the automatic suspension.
  @Column({ name: 'triggered_by_person_id', type: 'uuid' })
  triggeredByPersonId: string;

  // open | resolved (DB CHECK). No TTL — an item never expires on its own.
  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  // Resolution columns — all NULL while open, all required once resolved
  // (DB CHECK). Immutable opening columns above are protected by a
  // column-level GRANT that only allows UPDATE on these 4.
  @Column({ name: 'resolved_by_person_id', type: 'uuid', nullable: true })
  resolvedByPersonId: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  // Server clock only, immutable after creation.
  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'now()' })
  openedAt: Date;
}
