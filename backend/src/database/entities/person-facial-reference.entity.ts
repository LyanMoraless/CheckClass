import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Maps a device's LOCAL facial match reference (resolved on-device by OpenCV,
// never a raw image/template — privacy decision 2026-08-21) to a person.
// Scoped per-device because each Raspberry keeps its own local face database;
// the same person can have a different local_reference on a different device.
@Entity({ name: 'person_facial_reference' })
export class PersonFacialReferenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'device_id', type: 'uuid' })
  deviceId: string;

  @Column({ name: 'local_reference', type: 'varchar', length: 255 })
  localReference: string;

  @Column({ name: 'person_id', type: 'uuid' })
  personId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
