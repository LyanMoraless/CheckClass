import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Declared record of a student<->legal-guardian link (RULE-GRD-02), no
// account/credential of its own. See AddLegalGuardianAndLocationConsentDecision
// migration for the full reasoning.
@Entity({ name: 'legal_guardian' })
export class LegalGuardianEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'student_person_id', type: 'uuid' })
  studentPersonId: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255 })
  fullName: string;

  @Column({ name: 'document_number', type: 'varchar', length: 50 })
  documentNumber: string;

  // Timestamp of the presencial capture (RULE-GRD-05: no document/image is
  // stored, only the fact and moment of the conferência).
  @Column({ name: 'signature_captured_at', type: 'timestamptz' })
  signatureCapturedAt: Date;

  // Secretaria staff who registered the link.
  @Column({ name: 'registered_by_person_id', type: 'uuid' })
  registeredByPersonId: string;

  // active | revoked (RULE-GRD-06) — status column, never physical deletion.
  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
