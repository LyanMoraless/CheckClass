import { Injectable } from '@nestjs/common';
import { ClassSessionEntity, ClassSessionRequiredFactorEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { TenantConfigService } from '../config/tenant-config.service';

export interface CreateClassSessionInput {
  classGroupId: string;
  roomId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

// The only place class_session rows get created. Resolves the effective
// attendance_config (TenantConfigService) and snapshots it onto the session
// at creation time — RULE-ATT-04/05: a later config change must never
// retroactively recalculate an already-scheduled/past session.
@Injectable()
export class ClassSessionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly configService: TenantConfigService,
  ) {}

  async createSession(input: CreateClassSessionInput): Promise<ClassSessionEntity> {
    const effective = await this.configService.resolveEffectiveConfig(input.classGroupId);

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(ClassSessionEntity);

    const session = repository.create({
      tenantId,
      classGroupId: input.classGroupId,
      roomId: input.roomId,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      minAttendancePercentageSnapshot: effective.minAttendancePercentage,
      toleranceMinutesSnapshot: effective.toleranceMinutes,
      postToleranceBehaviorSnapshot: effective.postToleranceBehavior,
    });
    const saved = await repository.save(session);

    if (effective.requiredFactorTypeIds.length > 0) {
      const factorRepository = manager.getRepository(ClassSessionRequiredFactorEntity);
      const rows = effective.requiredFactorTypeIds.map((factorTypeId) =>
        factorRepository.create({ tenantId, classSessionId: saved.id, attendanceFactorTypeId: factorTypeId }),
      );
      await factorRepository.save(rows);
    }

    return saved;
  }
}
