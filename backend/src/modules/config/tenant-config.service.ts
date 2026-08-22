import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  AttendanceConfigEntity,
  AttendanceConfigRequiredFactorEntity,
  ClassGroupEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ConfigScopeType } from './config-scope-type.enum';
import { PostToleranceBehavior } from './post-tolerance-behavior.enum';

export interface ResolvedAttendanceConfig {
  configId: string;
  minAttendancePercentage: number;
  toleranceMinutes: number;
  postToleranceBehavior: string;
  requiredFactorTypeIds: string[];
}

export interface UpsertConfigInput {
  scopeType: ConfigScopeType;
  scopeId: string | null;
  minAttendancePercentage: number;
  toleranceMinutes: number;
  postToleranceBehavior: PostToleranceBehavior;
}

// "Serviço de Configuração por Instituição (Tenant)" (architecture-overview.md):
// single source of truth for required factors, minimum attendance %,
// tolerance, and post-tolerance behavior (RULE-ATT-02/04/05/13/14). The
// Motor de Regras (later stage) only ever reads through this — it never
// touches attendance_config directly. Values here are never fixed constants
// (configurable-parameters.md): every number comes from this table, per
// tenant/course/class_group.
@Injectable()
export class TenantConfigService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Resolution order: class_group-specific config wins over its course's,
  // which wins over the institution-wide default. Whoever calls this at
  // session-creation time is expected to snapshot the result onto
  // class_session (RULE-ATT-04/05: config changes must not retroactively
  // recalculate past sessions).
  async resolveEffectiveConfig(classGroupId: string): Promise<ResolvedAttendanceConfig> {
    const manager = this.tenantContext.getManager();

    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }

    const config =
      (await this.findConfig(ConfigScopeType.CLASS_GROUP, classGroupId)) ??
      (await this.findConfig(ConfigScopeType.COURSE, classGroup.courseId)) ??
      (await this.findConfig(ConfigScopeType.INSTITUTION, null));

    if (!config) {
      throw new UnprocessableEntityException(
        `No attendance_config found for class_group ${classGroupId}, its course, or the institution — configure at least an institution-wide default first`,
      );
    }

    const requiredFactors = await manager
      .getRepository(AttendanceConfigRequiredFactorEntity)
      .findBy({ attendanceConfigId: config.id });

    return {
      configId: config.id,
      minAttendancePercentage: Number(config.minAttendancePercentage),
      toleranceMinutes: config.toleranceMinutes,
      postToleranceBehavior: config.postToleranceBehavior,
      requiredFactorTypeIds: requiredFactors.map((factor) => factor.attendanceFactorTypeId),
    };
  }

  async upsertConfig(input: UpsertConfigInput): Promise<AttendanceConfigEntity> {
    this.validate(input);

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(AttendanceConfigEntity);

    const existing = await this.findConfig(input.scopeType, input.scopeId);
    if (existing) {
      await repository.update(
        { id: existing.id },
        {
          minAttendancePercentage: input.minAttendancePercentage,
          toleranceMinutes: input.toleranceMinutes,
          postToleranceBehavior: input.postToleranceBehavior,
        },
      );
      return repository.findOneByOrFail({ id: existing.id });
    }

    const created = repository.create({
      tenantId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      minAttendancePercentage: input.minAttendancePercentage,
      toleranceMinutes: input.toleranceMinutes,
      postToleranceBehavior: input.postToleranceBehavior,
    });
    return repository.save(created);
  }

  async setRequiredFactors(configId: string, factorTypeIds: string[]): Promise<void> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(AttendanceConfigRequiredFactorEntity);

    await repository.delete({ attendanceConfigId: configId });
    if (factorTypeIds.length === 0) {
      return;
    }
    const rows = factorTypeIds.map((factorTypeId) =>
      repository.create({ tenantId, attendanceConfigId: configId, attendanceFactorTypeId: factorTypeId }),
    );
    await repository.save(rows);
  }

  private async findConfig(scopeType: ConfigScopeType, scopeId: string | null): Promise<AttendanceConfigEntity | null> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(AttendanceConfigEntity).findOneBy({
      scopeType,
      scopeId: scopeId ?? IsNull(),
    });
  }

  private validate(input: UpsertConfigInput): void {
    if (input.minAttendancePercentage < 0 || input.minAttendancePercentage > 100) {
      throw new BadRequestException('minAttendancePercentage must be between 0 and 100');
    }
    if (input.toleranceMinutes < 0) {
      throw new BadRequestException('toleranceMinutes must be >= 0');
    }
    if (!Object.values(PostToleranceBehavior).includes(input.postToleranceBehavior)) {
      // RULE-ATT-14: not extensible by the institution, unlike factor types.
      throw new BadRequestException(
        `postToleranceBehavior must be one of: ${Object.values(PostToleranceBehavior).join(', ')}`,
      );
    }
    if (input.scopeType !== ConfigScopeType.INSTITUTION && !input.scopeId) {
      throw new BadRequestException(`scopeId is required for scopeType ${input.scopeType}`);
    }
  }
}
