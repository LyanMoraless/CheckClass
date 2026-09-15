import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Append-only consent log (RULE-PRES-14) — never UPDATE/DELETE; effective
// status = most recent row per subjectPersonId. See
// AddLegalGuardianAndLocationConsentDecision migration for the full
// reasoning, including the decidedBy* mutual-exclusivity CHECK.
@Entity({ name: 'location_consent_decision' })
export class LocationConsentDecisionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // Titular do consentimento — equals decidedByPersonId when the student
  // decides for themself, equals legal_guardian.studentPersonId when a
  // guardian decides. Denormalized to avoid a join through legal_guardian
  // on RULE-PRES-01's hot login path.
  @Column({ name: 'subject_person_id', type: 'uuid' })
  subjectPersonId: string;

  // person | legal_guardian | system — drives which of the two FKs below
  // (if any) must be set; see the DB exclusivity CHECK.
  @Column({ name: 'decided_by_type', type: 'varchar', length: 20 })
  decidedByType: string;

  // Mutually exclusive pair — exactly one of the two is set when
  // decidedByType is 'person'/'legal_guardian'; both NULL when 'system'
  // (DB CHECK).
  @Column({ name: 'decided_by_person_id', type: 'uuid', nullable: true })
  decidedByPersonId: string | null;

  @Column({ name: 'decided_by_legal_guardian_id', type: 'uuid', nullable: true })
  decidedByLegalGuardianId: string | null;

  // granted | refused | revoked. DB CHECK forbids decidedByType='system'
  // paired with anything but 'revoked' — the system never has LGPD Art. 14
  // basis to grant/refuse on a subject's behalf.
  @Column({ type: 'varchar', length: 20 })
  decision: string;

  // Which human action triggered an automatic ('system') suspension —
  // distinct from decidedBy*, which record who decided (nobody, here; the
  // system did). Only ever set when decidedByType = 'system', and even
  // then may be unknown/NULL (DB CHECK).
  @Column({ name: 'system_action_triggered_by_person_id', type: 'uuid', nullable: true })
  systemActionTriggeredByPersonId: string | null;

  // Which version of the consent text was shown when this decision was captured.
  @Column({ name: 'consent_version', type: 'varchar', length: 50 })
  consentVersion: string;

  // Server clock only.
  @Column({ name: 'captured_at', type: 'timestamptz', default: () => 'now()' })
  capturedAt: Date;
}
