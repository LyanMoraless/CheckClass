import { Injectable } from '@nestjs/common';
import { CourseEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface CreateCourseInput {
  name: string;
  code?: string;
}

@Injectable()
export class CourseService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateCourseInput): Promise<CourseEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(CourseEntity);
    return repository.save(repository.create({ tenantId, name: input.name, code: input.code ?? null }));
  }

  async list(): Promise<CourseEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(CourseEntity).find();
  }
}
