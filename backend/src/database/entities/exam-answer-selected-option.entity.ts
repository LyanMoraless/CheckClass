import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Checked options of an objective answer: several rows for CHECKBOXES,
// exactly one for MULTIPLE_CHOICE (the "exactly one" part is an
// application-layer rule — SQL cannot express it without a trigger).
@Entity({ name: 'exam_answer_selected_option' })
export class ExamAnswerSelectedOptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_answer_id', type: 'uuid' })
  examAnswerId: string;

  // Same denormalization as exam_answer, and for the same reason: which
  // option another student picked is already a leak of their answer, so
  // this table carries the ownership predicate too instead of relying on
  // tenant isolation alone.
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'exam_question_option_id', type: 'uuid' })
  examQuestionOptionId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
