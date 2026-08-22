import { Injectable } from '@nestjs/common';
import { RoomEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

@Injectable()
export class RoomService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(name: string): Promise<RoomEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(RoomEntity);
    return repository.save(repository.create({ tenantId, name }));
  }

  async list(): Promise<RoomEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(RoomEntity).find();
  }
}
