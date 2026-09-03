import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-EXAM-04: proctoring reaction mode, one row per exam.
@Entity({ name: 'exam_monitoring_config' })
export class ExamMonitoringConfigEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  // TERMINATE = end the session on a violation; LOG_ONLY = record it and
  // let the student continue. No default: RULE-EXAM-13 makes it an explicit
  // choice of the teacher.
  @Column({ name: 'monitoring_mode', type: 'varchar', length: 20 })
  monitoringMode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
