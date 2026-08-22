import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'presence_interval' })
export class PresenceIntervalEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'class_session_id', type: 'uuid' })
  classSessionId: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @Column({ name: 'entry_at', type: 'timestamptz' })
  entryAt: Date;

  // Null while the matching exit event has not arrived (RULE-ATT-09) —
  // never assumed to be the session end.
  @Column({ name: 'exit_at', type: 'timestamptz', nullable: true })
  exitAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
