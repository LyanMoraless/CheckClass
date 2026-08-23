import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// RULE-SEC-02's movement trail: one row per correlated signal appended to an
// open incident, never overwritten. See AddIntrusionIncident migration.
@Entity({ name: 'intrusion_incident_location_entry' })
export class IntrusionIncidentLocationEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'intrusion_incident_id', type: 'uuid' })
  intrusionIncidentId: string;

  @Column({ name: 'raw_security_event_id', type: 'uuid' })
  rawSecurityEventId: string;

  @Column({ name: 'area_id', type: 'uuid' })
  areaId: string;

  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
