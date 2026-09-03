import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Only objective questions (MULTIPLE_CHOICE / CHECKBOXES) have options —
// validated in the application layer, since expressing it in SQL would
// require a trigger the approved model does not justify.
@Entity({ name: 'exam_question_option' })
export class ExamQuestionOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_question_id', type: 'uuid' })
  examQuestionId: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'int' })
  position: number;

  // Answer key of RULE-EXAM-14 — kept on the option (not the question)
  // because CHECKBOXES has several correct ones. Never served to a student
  // (RULE-EXAM-17): the student-facing DTO must allow-list its fields.
  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
