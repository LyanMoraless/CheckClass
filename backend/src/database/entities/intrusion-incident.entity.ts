import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Motor de Detecção de Intrusão's incident record. See AddIntrusionIncident
// migration for the full reasoning (nullable identity, current_area_id
// denormalization, RULE-SEC-07 closure invariants, "index case" single-open
// -incident-per-tenant behavior).
@Entity({ name: 'intrusion_incident' })
export class IntrusionIncidentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // Null when the incident originated from an anonymous IR barrier crossing
  // with no correlated identity yet.
  @Column({ name: 'person_id', type: 'uuid', nullable: true })
  personId: string | null;

  @Column({ name: 'wristband_category_id', type: 'uuid', nullable: true })
  wristbandCategoryId: string | null;

  // Denormalized for the RULE-SEC-03 camera auto-follow polling read path —
  // written alongside each new intrusion_incident_location_entry row, never
  // read-derived.
  @Column({ name: 'current_area_id', type: 'uuid', nullable: true })
  currentAreaId: string | null;

  // open | closed
  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string;

  @CreateDateColumn({ name: 'opened_at' })
  openedAt: Date;

  // resolved | false_positive (RULE-SEC-07) — set together with
  // resolution_note/closed_by_person_id/closed_at, enforced by a DB CHECK.
  @Column({ type: 'varchar', length: 20, nullable: true })
  outcome: string | null;

  @Column({ name: 'resolution_note', type: 'text', nullable: true })
  resolutionNote: string | null;

  // Any "Equipe de segurança" member — flat authorization, no leadership
  // hierarchy table (RULE-SEC-07).
  @Column({ name: 'closed_by_person_id', type: 'uuid', nullable: true })
  closedByPersonId: string | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
