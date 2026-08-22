import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'device' })
export class DeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'room_id', type: 'uuid', nullable: true })
  roomId: string | null;

  @Column({ name: 'device_type', type: 'varchar', length: 50 })
  deviceType: string;

  @Column({ name: 'external_identifier', type: 'varchar', length: 255 })
  externalIdentifier: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'api_key_id', type: 'varchar', length: 64 })
  apiKeyId: string;

  @Column({ name: 'api_key_secret_hash', type: 'varchar', length: 128 })
  apiKeySecretHash: string;

  @Column({ name: 'api_key_created_at', type: 'timestamptz' })
  apiKeyCreatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
