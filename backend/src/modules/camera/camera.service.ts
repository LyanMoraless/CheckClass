import { Injectable, NotFoundException } from '@nestjs/common';
import { AreaEntity, CameraEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface CreateCameraInput {
  name: string;
  areaId: string;
  streamUrl: string;
}

// "Serviço de Câmeras — Cobertura de Área e Seleção Automática"
// (architecture-overview.md): stores cameraId -> areaId / cameraId ->
// streamUrl metadata only, exactly the approved tech-decision boundary — no
// camera vendor protocol (ONVIF/RTSP client/SDK) lives in this service.
@Injectable()
export class CameraService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateCameraInput): Promise<CameraEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const area = await manager.getRepository(AreaEntity).findOneBy({ id: input.areaId });
    if (!area) {
      throw new NotFoundException(`area ${input.areaId} not found`);
    }

    const repository = manager.getRepository(CameraEntity);
    return repository.save(repository.create({ tenantId, areaId: input.areaId, name: input.name, streamUrl: input.streamUrl }));
  }

  async list(): Promise<CameraEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(CameraEntity).find();
  }
}
