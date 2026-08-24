import { Injectable, NotFoundException } from '@nestjs/common';
import { AreaEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface CreateAreaInput {
  name: string;
  parentAreaId?: string | null;
}

// Configures the área hierarchy AreaAuthorizationService reads from
// (bloco -> área/andar/corredor, see AreaEntity). Without this module an
// institution had no way to create area rows at all, so every
// wristband_category_area_permission grant (RULE-ACC-02) and every
// isAuthorized() check was necessarily impossible in practice.
@Injectable()
export class AreaService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateAreaInput): Promise<AreaEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    if (input.parentAreaId) {
      const parent = await manager.getRepository(AreaEntity).findOneBy({ id: input.parentAreaId });
      if (!parent) {
        throw new NotFoundException(`area ${input.parentAreaId} not found`);
      }
    }

    const repository = manager.getRepository(AreaEntity);
    return repository.save(repository.create({ tenantId, parentAreaId: input.parentAreaId ?? null, name: input.name }));
  }

  async list(): Promise<AreaEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(AreaEntity).find();
  }
}
