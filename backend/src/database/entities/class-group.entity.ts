import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'class_group' })
export class ClassGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  // RULE-INST-14: the Turma is a cohort that studies N Matérias — the set
  // lives in class_group_subject, never as a column here. The course is
  // first-class data again (it was derived through subject.courseId between
  // MigrateClassGroupToSubject and AddClassGroupSubjects): a turma with zero
  // matérias is a valid state (RULE-INST-08 addendum), so course can no
  // longer be derived from the subject set, and RULE-INST-09's whole
  // authorization model needs a course for every turma, empty ones included.
  // Every subject linked to this turma must belong to this same course —
  // enforced by ClassGroupService, not by a DB constraint.
  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // RULE-INST-07: the room is assigned once, here, at the turma level —
  // class_session.roomId now only holds a per-session override (NULL =
  // inherit this column). Nullable: turma composition can start before a
  // room is picked; "required before publishing the schedule" is a
  // montar-turma workflow rule (Backend Agent), not a DB invariant.
  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  // Approved architecture: the letivo period's start/end dates live on the
  // turma itself (no separate "Período Letivo" entity this round).
  @Column({ name: 'term_start_date', type: 'date', nullable: true })
  termStartDate: Date | null;

  @Column({ name: 'term_end_date', type: 'date', nullable: true })
  termEndDate: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
