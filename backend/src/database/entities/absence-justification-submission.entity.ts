import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Frente 07 — the "envio" of RULE-JUST-01 addendum/RULE-JUST-06: one date
// range, one legal category, one written description, one attachment,
// covering EVERY matéria the student had in the range. It unfolds into N
// absence_justification_item rows, one per faltada class_session — see that
// entity for why approved/rejected live there and not here.
//
// No status column here, on purpose. RULE-JUST-06 is explicit: "aprovado" e
// "rejeitado" são estados do ITEM, não do envio como um todo — an aggregate
// status column on this table would contradict that directly. The student's
// "cancelar enquanto ninguém decidiu" (RULE-JUST-05.4) is an action that
// transitions the still-open ITEMS to cancelled_by_student; whether it is
// still allowed (no item decided yet) is checked by the caller against item
// state at the moment of the request, not read from a column here.
//
// legal_category is a fixed, system-wide vocabulary this round (RULE-JUST-12,
// decision 1: "a lista é fixa... igual para todos os tenants", composition
// pending legal validation, not yet by any court or counsel). See the
// migration for the 9 CHECK'd slugs.
@Entity({ name: 'absence_justification_submission' })
export class AbsenceJustificationSubmissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // The student, and the titular of the sensitive data carried by this row
  // and everything hanging off it (RULE-JUST-04).
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  // Inclusive date range (RULE-JUST-01 addendum) — a single day is the
  // particular case where the two coincide. See the migration CHECK
  // (end_date >= start_date).
  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date' })
  endDate: Date;

  // One of the 9 slugs of RULE-JUST-12 — CHECK'd at the DB, see the
  // migration. Itself sensitive data (reveals health/belief), same access
  // cut as RULE-JUST-08/24: only the subject-teacher and the titular, never
  // leadership in full (DTO allow-list) — RLS on this table (see migration)
  // controls the ROW, not this column; the column-level cut is a DTO
  // concern layered on top, same split already used for RULE-EXAM-17.
  @Column({ name: 'legal_category', type: 'varchar', length: 50 })
  legalCategory: string;

  @Column({ type: 'text' })
  description: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
