import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { ClassGroupEntity, ClassGroupScheduleSlotEntity, ClassGroupSubjectEntity } from '../../database/entities';
import { timeToSeconds } from '../../common/utc-date.util';
import { TenantContextService } from '../../database/tenant-context.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { GenerateForRangeResult, SessionGenerationService } from './session-generation.service';
import { ScheduleRegenerationService } from './schedule-regeneration.service';

export interface CreateScheduleSlotInput {
  // RULE-INST-14: which of the turma's matérias this weekly slot teaches —
  // must be one the turma currently has linked (class_group_subject).
  subjectId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

// RULE-INST-04/07/09/10 — architecture-overview.md's "Cronograma automático"
// module. Owns the recurring weekly grade (class_group_schedule_slot) CRUD
// and its bulk session-generation entry point. The actual "grade -> concrete
// class_session rows" projection/conflict-check/create pipeline lives in
// SessionGenerationService (shared with ScheduleRegenerationService, so this
// class and that one never duplicate it) — this service's own job is
// authorization, precondition validation, and wiring createSlot/deleteSlot to
// automatically trigger regeneration of future sessions (RULE-INST-04 item
// #5, ScheduleRegenerationService).
@Injectable()
export class ClassScheduleService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly leadershipScope: LeadershipScopeService,
    private readonly sessionGeneration: SessionGenerationService,
    private readonly scheduleRegeneration: ScheduleRegenerationService,
  ) {}

  // RULE-INST-09: grade/horário is explicitly listed among the fields that
  // require leadership authority over the turma's course to edit — same
  // cumulative-with-MANAGE_INSTITUTION_STRUCTURE pattern as ClassGroupService.
  async createSlot(
    classGroupId: string,
    input: CreateScheduleSlotInput,
    authenticatedPersonId: string,
  ): Promise<ClassGroupScheduleSlotEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    await this.resolveClassGroupWithAuthority(manager, classGroupId, authenticatedPersonId);

    if (timeToSeconds(input.endTime) <= timeToSeconds(input.startTime)) {
      throw new BadRequestException('endTime must be after startTime');
    }

    // RULE-INST-14: a slot can only teach a matéria the turma actually has.
    // Application-level by design (architecture-overview.md, Frente 05) — the
    // schema keeps a plain FK to subject so unlinking a matéria later doesn't
    // orphan the historical sessions it generated.
    await this.assertSubjectBelongsToClassGroup(manager, classGroupId, input.subjectId);

    const repository = manager.getRepository(ClassGroupScheduleSlotEntity);
    const saved = await repository.save(
      repository.create({
        tenantId,
        classGroupId,
        subjectId: input.subjectId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
      }),
    );

    // RULE-INST-04 item #5: editing the recurring grade regenerates future,
    // untouched sessions automatically, in the same request transaction —
    // TenantContextInterceptor already wraps the whole HTTP request in one DB
    // transaction (TenantContextService.runWithTenant), so no extra
    // manager.transaction() wrapper is needed here: if regeneration hits a
    // conflict (RULE-INST-10), the new slot save above rolls back too.
    await this.scheduleRegeneration.regenerateFutureSessions(classGroupId, authenticatedPersonId);

    return saved;
  }

  // RULE-INST-09 scopes the leadership-authority requirement to "montar ou
  // editar" a turma's schedule, not to reading it — same read-only shape as
  // the sibling read endpoints created in this same task sequence
  // (ClassGroupController.list/listEnrollments, ClassSessionController.list),
  // none of which check LeadershipScopeService either.
  // MANAGE_INSTITUTION_STRUCTURE (checked at the controller) still applies.
  async listSlots(classGroupId: string): Promise<ClassGroupScheduleSlotEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager
      .getRepository(ClassGroupScheduleSlotEntity)
      .find({ where: { classGroupId }, order: { dayOfWeek: 'ASC', startTime: 'ASC', subjectId: 'ASC' } });
  }

  async deleteSlot(classGroupId: string, slotId: string, authenticatedPersonId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    await this.resolveClassGroupWithAuthority(manager, classGroupId, authenticatedPersonId);

    const repository = manager.getRepository(ClassGroupScheduleSlotEntity);
    const slot = await repository.findOneBy({ id: slotId, classGroupId });
    if (!slot) {
      throw new NotFoundException(`class_group_schedule_slot ${slotId} not found for class_group ${classGroupId}`);
    }
    await repository.delete({ id: slotId });

    // See createSlot's identical comment above — same regeneration trigger,
    // same single-transaction reasoning.
    await this.scheduleRegeneration.regenerateFutureSessions(classGroupId, authenticatedPersonId);
  }

  // RULE-INST-04: generates class_session rows for every (date, slot)
  // combination between the turma's termStartDate/termEndDate (inclusive)
  // whose weekday matches a recurring slot, skipping institutional holidays.
  // Requires termStartDate/termEndDate AND roomId already set on the turma
  // (RULE-INST-07 — room lives at the turma level, not per session).
  //
  // Idempotency decision (a documented Backend Agent decision): calling this
  // twice for the same turma must not silently duplicate sessions. A (date,
  // slot) combination is skipped if a class_session already exists for this
  // exact classGroupId + scheduledStart with status 'scheduled' or 'edited'
  // (i.e. anything not cancelled) — a previously-cancelled session at that
  // same slot is deliberately left alone rather than re-created here. This is
  // this bulk-generate entry point's OWN choice, and is deliberately
  // different from ScheduleRegenerationService.regenerateFutureSessions'
  // choice (which also dedupes against 'cancelled', so a pontual cancellation
  // always sticks across a later grade edit, per RULE-INST-04 item #5) —
  // generateSessions is the FIRST bulk generation over a turma that has no
  // pontual history yet to protect, so there is no meaningful difference
  // between "recreate over a cancelled slot" and "leave it cancelled" for
  // that one-time first pass; regeneration on a live, already-in-use grade is
  // exactly where that difference starts to matter.
  async generateSessions(classGroupId: string, authenticatedPersonId: string): Promise<GenerateForRangeResult> {
    const manager = this.tenantContext.getManager();
    const classGroup = await this.resolveClassGroupWithAuthority(manager, classGroupId, authenticatedPersonId);

    if (!classGroup.termStartDate || !classGroup.termEndDate) {
      throw new BadRequestException(
        `class_group ${classGroupId} has no term period defined — set termStartDate and termEndDate before generating sessions (RULE-INST-04)`,
      );
    }
    if (!classGroup.roomId) {
      throw new BadRequestException(
        `class_group ${classGroupId} has no room assigned — set roomId before generating sessions (RULE-INST-07)`,
      );
    }

    const slots = await manager.getRepository(ClassGroupScheduleSlotEntity).findBy({ classGroupId });

    return this.sessionGeneration.generateForRange({
      classGroup,
      slots,
      rangeStartDate: classGroup.termStartDate,
      rangeEndDate: classGroup.termEndDate,
      dedupeStatuses: ['scheduled', 'edited'],
      authenticatedPersonId,
    });
  }

  private async resolveClassGroupWithAuthority(
    manager: EntityManager,
    classGroupId: string,
    authenticatedPersonId: string,
  ): Promise<ClassGroupEntity> {
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }

    const authorized = await this.leadershipScope.hasAuthorityOverClassGroup(
      authenticatedPersonId,
      classGroup.courseId,
      classGroupId,
    );
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${authenticatedPersonId} has no leadership authority over class_group ${classGroupId} (RULE-INST-09)`,
      );
    }
    return classGroup;
  }

  private async assertSubjectBelongsToClassGroup(
    manager: EntityManager,
    classGroupId: string,
    subjectId: string,
  ): Promise<void> {
    const link = await manager.getRepository(ClassGroupSubjectEntity).findOneBy({ classGroupId, subjectId });
    if (!link) {
      throw new BadRequestException(
        `subject ${subjectId} is not linked to class_group ${classGroupId} — add it to the turma before scheduling it (RULE-INST-14)`,
      );
    }
  }
}
