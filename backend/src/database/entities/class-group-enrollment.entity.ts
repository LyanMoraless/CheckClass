import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'class_group_enrollment' })
export class ClassGroupEnrollmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  // RULE-INST-11: fixed 4-value enum (Ativo/Trancado/Formado/Evadido), free
  // transitions between all four (no state machine — confirmed). English
  // naming favors actual academic-English terms over literal translation:
  // active | on_leave | graduated | withdrawn.
  @Column({ name: 'enrollment_status', type: 'varchar', length: 20, default: 'active' })
  enrollmentStatus: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
