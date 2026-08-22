import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'leadership_assignment' })
export class LeadershipAssignmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'leadership_role_id', type: 'uuid' })
  leadershipRoleId: string;

  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId: string | null;

  // Nullable, same scoping pattern as attendance_config: NULL = applies to
  // every class_group under courseId (or, with courseId also NULL, to the
  // whole institution). RULE-ATT-12 authorization narrows to this when set.
  @Column({ name: 'class_group_id', type: 'uuid', nullable: true })
  classGroupId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
