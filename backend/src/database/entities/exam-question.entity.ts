import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'exam_question' })
export class ExamQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  // RULE-EXAM-03, definitive set:
  // MULTIPLE_CHOICE | CHECKBOXES | SHORT_ANSWER | PARAGRAPH.
  @Column({ name: 'question_type', type: 'varchar', length: 20 })
  questionType: string;

  @Column({ type: 'text' })
  prompt: string;

  // Display order only — not unique per exam, so reordering never fights a
  // constraint (ties broken by id).
  @Column({ type: 'int' })
  position: number;

  // How much the question is worth at most, for EVERY type. Objective types
  // are graded automatically against the answer key up to this value;
  // subjective ones get a value assigned manually by the teacher up to this
  // same maximum (RULE-EXAM-14). NULL = the question carries no score,
  // which is what lets an exam with no answer key behave like a plain form.
  //
  // Never served to a student, during or after the exam (RULE-EXAM-17).
  @Column({ type: 'numeric', precision: 6, scale: 2, nullable: true })
  points: number | null;

  // There is deliberately no isRequired column: every question is optional
  // (confirmed 2026-09-03) — a blank answer is allowed and scores zero.

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
