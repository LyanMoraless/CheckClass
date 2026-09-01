import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// RULE-INST-04 (institutional-scope closure): a holiday applies to the whole
// institution, not a room/turma — tenant-scoped only, no room_id/class_group_id.
// A holiday on a date that already has generated class_session rows
// auto-cancels those sessions (see class_session.status in AddClassSessionScheduleFields).
@Entity({ name: 'holiday' })
export class HolidayEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
