import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-JUST-24's blocking dependency: "quem leciona esta matéria, nesta
// turma" — a fact that did not exist anywhere in the schema before Frente
// 07. class_group_enrollment (person<->turma) and class_group_subject
// (turma<->matéria) each answer half the question; neither answers the
// other half, and LeadershipScopeService.hasAuthorityOverClassGroup is
// explicitly the WRONG tool here because it walks the leadership chain,
// which RULE-JUST-08/24 deliberately exclude from attachment/category/motivo
// access.
//
// A brand new N:N junction, not an extension of either existing table, on
// purpose:
//   - extending class_group_enrollment would force one enrollment row per
//     matéria taught, conflating "is a member of this turma" (independent of
//     matéria) with "teaches this specific matéria" — and would need a
//     nullable subject_id on a table students also use;
//   - extending class_group_subject (a teacher_person_id column) would bake
//     in "exactly one teacher per (turma, matéria)", which RULE-INST-05's
//     co-docência never assumed and this rule has no basis to assume either.
// A real junction supports co-teaching a matéria and one teacher covering
// several matérias in the same turma — same relational idiom already used
// for class_group_enrollment/class_group_subject ("associação explícita com
// tabela de junção em vez de array/jsonb de ids").
//
// class_group_id/subject_id are direct FKs, not a FK to class_group_subject
// — the query this table exists to answer ("é o professor responsável por
// esta matéria, nesta turma") is a flat WHERE on these two columns plus
// person_id, fully covered by the leading columns of the UNIQUE index below,
// no extra index needed (same reasoning already applied to
// attendance_frequency_warning's uniqueness index).
//
// Application-layer invariants, NOT DB constraints (same posture already
// used for class_group.courseId / subject.courseId):
//   - subject_id must be among class_group_id's currently linked matérias
//     (a row must exist in class_group_subject for the same pair);
//   - person_id should hold an active class_group_enrollment with
//     role = 'teacher' for class_group_id.
//
// Known gap, explicitly NOT solved by this migration (registered in
// pending-decisions.md as non-blocking, scope kept out of Frente 07 by the
// user): there is no administrative flow yet to assign a teacher to a
// specific matéria (only to a whole turma, RULE-INST-05). This table starts
// empty; population is manual/script this round.
//
// Whoever implements "remove a matéria from a turma" (the narrower sibling
// operation of ClassGroupDeletionOrchestrator already flagged in
// architecture-overview.md) must also delete this table's rows for that
// (class_group_id, subject_id) pair — nothing here does that automatically,
// because the FK targets are plain columns, not class_group_subject.id.
@Entity({ name: 'class_group_subject_teacher' })
export class ClassGroupSubjectTeacherEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  // The teacher. Deliberately a plain person_id, not a FK to a specific
  // class_group_enrollment row — the enrollment invariant (role = 'teacher')
  // is validated at write time by the application, not carried structurally
  // here (see the invariants note above).
  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
