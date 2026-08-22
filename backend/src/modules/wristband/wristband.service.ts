import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { PersonEntity, WristbandCategoryEntity, WristbandEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

const UNIQUE_VIOLATION = '23505';

export interface IssueWristbandInput {
  personId: string;
  wristbandCategoryId: string;
  tagCode: string;
}

// RULE-ACC-01: a wristband/tag represents the holder's identity in the
// physical system. Revoking sets status inactive rather than deleting — a
// deactivated wristband must stop authenticating (IdentificationService
// already filters on status='active') but the historical record of who
// held which tag stays intact for audit purposes.
@Injectable()
export class WristbandService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async createCategory(name: string): Promise<WristbandCategoryEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(WristbandCategoryEntity);
    return repository.save(repository.create({ tenantId, name }));
  }

  async listCategories(): Promise<WristbandCategoryEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(WristbandCategoryEntity).find();
  }

  async issue(input: IssueWristbandInput): Promise<WristbandEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const person = await manager.getRepository(PersonEntity).findOneBy({ id: input.personId });
    if (!person) {
      throw new NotFoundException(`person ${input.personId} not found`);
    }
    const category = await manager.getRepository(WristbandCategoryEntity).findOneBy({ id: input.wristbandCategoryId });
    if (!category) {
      throw new NotFoundException(`wristband_category ${input.wristbandCategoryId} not found`);
    }

    const repository = manager.getRepository(WristbandEntity);
    try {
      return await repository.save(
        repository.create({
          tenantId,
          personId: input.personId,
          wristbandCategoryId: input.wristbandCategoryId,
          tagCode: input.tagCode,
        }),
      );
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        throw new ConflictException(`tagCode "${input.tagCode}" is already in use for this institution`);
      }
      throw error;
    }
  }

  async revoke(wristbandId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(WristbandEntity);
    const wristband = await repository.findOneBy({ id: wristbandId });
    if (!wristband) {
      throw new NotFoundException(`wristband ${wristbandId} not found`);
    }
    await repository.update({ id: wristbandId }, { status: 'inactive' });
  }

  async listByPerson(personId: string): Promise<WristbandEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(WristbandEntity).findBy({ personId });
  }
}
