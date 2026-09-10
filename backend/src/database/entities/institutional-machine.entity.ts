import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// RULE-DEV-04's inventory of an institutional machine (four required field
// groups, no exceptions documented) — separate from `device` (RULE-DEV-03).
// `id` is shared with the device_identity row it extends (class-table-
// inheritance), never generated independently here.
@Entity({ name: 'institutional_machine' })
export class InstitutionalMachineEntity {
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'asset_tag', type: 'varchar', length: 100 })
  assetTag: string;

  @Column({ name: 'serial_number', type: 'varchar', length: 100 })
  serialNumber: string;

  // RULE-DEV-09: reuses `room` (the same FK type class_session/class_group
  // already use) so "sala da máquina == sala da sessão" is a plain id
  // equality. "Bloco" is not a separate column — room.area_id already
  // chains into the area hierarchy (AddArea migration) whose top-level rows
  // model "bloco".
  @Column({ name: 'room_id', type: 'uuid' })
  roomId: string;

  // active | maintenance | decommissioned | stolen (RULE-DEV-04).
  @Column({ type: 'varchar', length: 20 })
  status: string;

  @Column({ type: 'varchar', length: 255 })
  brand: string;

  @Column({ type: 'varchar', length: 255 })
  model: string;

  @Column({ type: 'varchar', length: 255 })
  processor: string;

  @Column({ name: 'memory_description', type: 'varchar', length: 255 })
  memoryDescription: string;

  @Column({ name: 'operating_system', type: 'varchar', length: 255 })
  operatingSystem: string;

  // RULE-DEV-05: informative/inventory metadata only, never authorization.
  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
