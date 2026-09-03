import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-INST-14 (cenário 1, "turma fechada"): the set of Matérias a Turma
// studies. Zero rows for a turma is a valid state — a turma survives losing
// its last matéria (RULE-INST-08 addendum, confirmed by the user) and waits
// for a new one to be linked, keeping its enrollments and history.
// See architecture-overview.md, "Decisão de arquitetura — Turma com várias
// matérias, Frente 05".
@Entity({ name: 'class_group_subject' })
export class ClassGroupSubjectEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
