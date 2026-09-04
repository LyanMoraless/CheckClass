import { BadRequestException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { IsNull } from 'typeorm';
import {
  AttendanceConfigEntity,
  AttendanceConfigRequiredFactorEntity,
  AttendanceFactorTypeEntity,
  ClassGroupEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { AccumulatedFrequencyPeriod } from './accumulated-frequency-period.enum';
import { ConfigScopeType } from './config-scope-type.enum';
import { PostToleranceBehavior } from './post-tolerance-behavior.enum';

export interface ResolvedAttendanceConfig {
  configId: string;
  minAttendancePercentage: number;
  // Controle B (RULE-FREQ-01 addendum / RULE-FREQ-02): resolved through the
  // exact same cascade as everything else here, but consumed with the
  // OPPOSITE lifetime — see the comment on resolveEffectiveConfig below.
  minAccumulatedFrequencyPercentage: number;
  accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod;
  toleranceMinutes: number;
  postToleranceBehavior: string;
  requiredFactorTypeIds: string[];
}

export interface UpsertConfigInput {
  scopeType: ConfigScopeType;
  scopeId: string | null;
  minAttendancePercentage: number;
  minAccumulatedFrequencyPercentage: number;
  accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod;
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
  //
  // CONTROLE B IS THE DELIBERATE EXCEPTION TO THAT SNAPSHOT SENTENCE, and it
  // is not an oversight to "fix" for symmetry: the two Controle B fields
  // (minAccumulatedFrequencyPercentage, accumulatedFrequencyPeriod) are
  // NEVER snapshotted anywhere — AttendanceFrequencyEngineService resolves
  // them live, on every recalculation. RULE-FREQ-02's addendum requires the
  // opposite of RULE-ATT-04/05 for the accumulated control: changing the
  // configuration while a reporting period is already running applies
  // immediately to that running period (it even re-slices the term, moving
  // boundaries of periods already elapsed). Snapshotting them would make the
  // past immune to the change, which is exactly what that rule forbids. The
  // divergence is confined to fields only Controle B reads — nothing about
  // Controle A's snapshot behavior changes.
  async resolveEffectiveConfig(classGroupId: string): Promise<ResolvedAttendanceConfig> {
    const manager = this.tenantContext.getManager();

    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }

    // RULE-INST-14: the turma carries its own courseId again — no subject hop,
    // and no ambiguity for a turma that studies several matérias (attendance
    // config is scoped to turma/course/institution, never to a matéria).
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
      minAccumulatedFrequencyPercentage: Number(config.minAccumulatedFrequencyPercentage),
      // The closed vocabulary is guaranteed by both validate() below and the
      // attendance_config_accumulated_frequency_period_check constraint, so
      // the column can only ever hold an enum member.
      accumulatedFrequencyPeriod: config.accumulatedFrequencyPeriod as AccumulatedFrequencyPeriod,
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
          minAccumulatedFrequencyPercentage: input.minAccumulatedFrequencyPercentage,
          accumulatedFrequencyPeriod: input.accumulatedFrequencyPeriod,
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
      // Both Controle B columns are NOT NULL without a DB default: a create
      // that omitted them wouldn't fall back to anything, it would fail with
      // a not-null violation.
      minAccumulatedFrequencyPercentage: input.minAccumulatedFrequencyPercentage,
      accumulatedFrequencyPeriod: input.accumulatedFrequencyPeriod,
      toleranceMinutes: input.toleranceMinutes,
      postToleranceBehavior: input.postToleranceBehavior,
    });
    return repository.save(created);
  }

  // Added for the admin frontend: the required-factors screen needs to show
  // which factor types exist to pick from (standard ones, tenant_id NULL,
  // plus any this tenant registered — though no endpoint creates custom ones
  // yet, so in practice this is just the seeded standard set today).
  async listFactorTypes(): Promise<AttendanceFactorTypeEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(AttendanceFactorTypeEntity).find({ order: { name: 'ASC' } });
  }

  // Added for the admin frontend: there was no read path for existing
  // config rows at all — the config screen needs to show what's already
  // set before offering to change it.
  async listConfigs(): Promise<AttendanceConfigEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(AttendanceConfigEntity).find({ order: { scopeType: 'ASC' } });
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
    // RULE-FREQ-01 addendum: an independent minimum with its own semantics
    // (attending the period's classes), validated with the same range as
    // Controle A's because both are percentages — not because one derives
    // from the other. The DB CHECK behind these two Controle B fields is a
    // safety net, never the message the administrator gets, for the same
    // reason already recorded for RULE-ATT-14 below.
    if (input.minAccumulatedFrequencyPercentage < 0 || input.minAccumulatedFrequencyPercentage > 100) {
      throw new BadRequestException('minAccumulatedFrequencyPercentage must be between 0 and 100');
    }
    if (!Object.values(AccumulatedFrequencyPeriod).includes(input.accumulatedFrequencyPeriod)) {
      // RULE-FREQ-02: closed set of three, not extensible by the institution.
      throw new BadRequestException(
        `accumulatedFrequencyPeriod must be one of: ${Object.values(AccumulatedFrequencyPeriod).join(', ')}`,
      );
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
