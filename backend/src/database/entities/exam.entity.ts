import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-EXAM-16: an exam always belongs to a class_group — student
// eligibility (active enrollment) and management/audit authorization both
// derive from that link. See AddExamArea migration for the full reasoning.
@Entity({ name: 'exam' })
export class ExamEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  // Authorship metadata only — authorization goes through the class group
  // and LeadershipScopeService (RULE-EXAM-16), never through this column.
  @Column({ name: 'created_by_person_id', type: 'uuid' })
  createdByPersonId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // Confirmed 2026-09-03: an exam is invisible to students until the teacher
  // publishes it — opening the availability window is NOT what exposes it.
  // Distinct question from the window: status = "is it ready to be taken",
  // window = "when may it be taken". A student who opens a half-built exam
  // has already burned their single attempt, so this is unrecoverable rather
  // than merely untidy. Values ('DRAFT' | 'PUBLISHED') are constrained by a
  // CHECK in the migration and by the module's DTOs — kept as a plain string
  // here, same convention as classGroupEnrollment.enrollmentStatus, so that
  // entities/index.ts stays a list of entity classes only.
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  // RULE-EXAM-06: availability window — when the student may START the
  // exam. Independent of durationMinutes.
  @Column({ name: 'available_from', type: 'timestamptz' })
  availableFrom: Date;

  @Column({ name: 'available_until', type: 'timestamptz' })
  availableUntil: Date;

  // RULE-EXAM-06: individual allowance counted from each student's own
  // start. NULL = no time limit (not "until the window closes").
  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
