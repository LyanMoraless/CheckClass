import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

// Serviço de Câmeras' inventory: cameraId -> areaId / cameraId -> streamUrl
// metadata only — the backend never speaks a camera vendor protocol. See
// AddCamera migration for the full reasoning.
@Entity({ name: 'camera' })
export class CameraEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'area_id', type: 'uuid' })
  areaId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'stream_url', type: 'text' })
  streamUrl: string;

  @Column({ type: 'varchar', length: 20, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
