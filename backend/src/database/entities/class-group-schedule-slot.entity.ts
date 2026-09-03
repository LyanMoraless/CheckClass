import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-INST-04/10: the recurring weekly grade a class_group's concrete
// class_session rows are generated/regenerated from (ScheduleConflictDetectionService/
// ScheduleRegenerationService, architecture-overview.md). One row per
// (class_group, weekday, time-of-day) slot — a Mon/Wed/Fri turma has 3 rows.
// Room is NOT duplicated here: RULE-INST-07 puts the single room on
// class_group itself, so conflict detection reads room from there. dayOfWeek
// follows JS Date.getDay() (0 = Sunday .. 6 = Saturday), matching how the
// Node/NestJS backend generates concrete session timestamps from this table.
@Entity({ name: 'class_group_schedule_slot' })
export class ClassGroupScheduleSlotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_group_id', type: 'uuid' })
  classGroupId: string;

  // RULE-INST-14: which Matéria this weekly slot teaches — a Mon/Wed turma
  // can hold Matemática on Monday and Física on Wednesday. Must be one of the
  // turma's currently linked subjects (class_group_subject) at write time,
  // validated by ClassScheduleService; the FK itself points straight at
  // subject so the value stays readable if that link is later removed.
  @Column({ name: 'subject_id', type: 'uuid' })
  subjectId: string;

  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
