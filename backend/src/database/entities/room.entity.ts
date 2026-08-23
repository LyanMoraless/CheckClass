import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'room' })
export class RoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  // Optional link to the coarser área/bloco hierarchy used by Segurança de
  // Intrusão (RULE-SEC-01/02) — null for every room predating that feature,
  // and never read by the attendance pipeline (class_session, presence
  // rules, etc.). See AddArea migration.
  @Column({ name: 'area_id', type: 'uuid', nullable: true })
  areaId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
