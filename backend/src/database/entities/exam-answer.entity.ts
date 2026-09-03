import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// One row per (session, question), UNIQUE — that is what makes incremental
// autosave possible instead of the answer existing only after a final
// submit.
@Entity({ name: 'exam_answer' })
export class ExamAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_session_id', type: 'uuid' })
  examSessionId: string;

  // Denormalized from exam_session so the RLS ownership policy is a plain
  // column comparison instead of a correlated subquery per row. A composite
  // FK (exam_session_id, person_id) -> exam_session (id, person_id) makes
  // the copy impossible to falsify.
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'exam_question_id', type: 'uuid' })
  examQuestionId: string;

  // SHORT_ANSWER / PARAGRAPH content; objective answers live in
  // exam_answer_selected_option. NULL/blank is a valid answer — every
  // question is optional (confirmed 2026-09-03).
  @Column({ name: 'answer_text', type: 'text', nullable: true })
  answerText: string | null;

  // Filled automatically for objective questions and manually by the
  // teacher for subjective ones, bounded by exam_question.points
  // (RULE-EXAM-14). NULL = not graded yet, which is why it is not defaulted
  // to 0. Never served to a student (RULE-EXAM-17).
  @Column({ name: 'awarded_points', type: 'numeric', precision: 6, scale: 2, nullable: true })
  awardedPoints: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
