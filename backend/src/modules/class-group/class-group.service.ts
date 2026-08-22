import { Injectable } from '@nestjs/common';
import { ClassGroupEnrollmentEntity, ClassGroupEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface CreateClassGroupInput {
  courseId: string;
  name: string;
}

export interface EnrollInput {
  classGroupId: string;
  personId: string;
  role: string;
}

@Injectable()
export class ClassGroupService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async create(input: CreateClassGroupInput): Promise<ClassGroupEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(ClassGroupEntity);
    return repository.save(repository.create({ tenantId, courseId: input.courseId, name: input.name }));
  }

  async list(courseId?: string): Promise<ClassGroupEntity[]> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(ClassGroupEntity);
    return courseId ? repository.findBy({ courseId }) : repository.find();
  }

  async enroll(input: EnrollInput): Promise<ClassGroupEnrollmentEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(ClassGroupEnrollmentEntity);

    const existing = await repository.findOneBy({ classGroupId: input.classGroupId, personId: input.personId });
    if (existing) {
      return existing; // already enrolled — not an error
    }
    return repository.save(
      repository.create({ tenantId, classGroupId: input.classGroupId, personId: input.personId, role: input.role }),
    );
  }

  async listEnrollments(classGroupId: string): Promise<ClassGroupEnrollmentEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(ClassGroupEnrollmentEntity).findBy({ classGroupId });
  }
}
