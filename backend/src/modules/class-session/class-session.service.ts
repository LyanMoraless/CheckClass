import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import {
  ClassGroupEntity,
  ClassGroupEnrollmentEntity,
  ClassSessionEntity,
  ClassSessionRequiredFactorEntity,
  RoomEntity,
  SubjectEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { TenantConfigService } from '../config/tenant-config.service';
import { LeadershipScopeService } from '../leadership-scope/leadership-scope.service';
import { ScheduleConflictDetectionService } from '../schedule-conflict-detection/schedule-conflict-detection.service';

export interface CreateClassSessionInput {
  classGroupId: string;
  // RULE-INST-07: optional. When provided, stored as-is — a pontual
  // (one-off) override of this specific session's room. When omitted, this
  // method still validates that SOME room is resolvable (either this input
  // or class_group.roomId — BadRequestException below if neither has one),
  // but the session is persisted with roomId = NULL, not a frozen snapshot
  // of class_group.roomId at creation time. That preserves true inheritance
  // (class-session.entity.ts's own "NULL = inherit class_group.roomId"
  // contract): if the turma's room is changed later, every session that
  // never got a pontual override keeps tracking it automatically.
  // ClassScheduleService.generateSessions (class-schedule module) always
  // omits this for exactly that reason.
  roomId?: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

// RULE-INST-04 (third-round update, item #3): fields editable on a pontual
// edit of one already-generated session — horário (scheduledStart/
// scheduledEnd, which also covers "data") and sala (roomId). scheduledStart
// and scheduledEnd are both required together (there is no well-defined
// meaning to changing just one without the other); roomId is optional — when
// omitted, the session's current roomId (an existing override, or null =
// still inheriting class_group.roomId) is left untouched.
export interface EditClassSessionInput {
  scheduledStart: Date;
  scheduledEnd: Date;
  roomId?: string;
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
    private readonly leadershipScope: LeadershipScopeService,
    private readonly conflictDetection: ScheduleConflictDetectionService,
  ) {}

  async createSession(input: CreateClassSessionInput, authenticatedPersonId: string): Promise<ClassSessionEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();
    const repository = manager.getRepository(ClassSessionEntity);

    // RULE-INST-09: MANAGE_INSTITUTION_STRUCTURE (checked at the controller)
    // is necessary but not sufficient — this manual creation path must pass
    // the same cumulative leadership-scope check as editSession/cancelSession
    // below, or a coordinator scoped to one course could create sessions in
    // any other course's turma. Security-review finding: this check was
    // previously entirely absent from createSession, the one class_session
    // write path that skipped it.
    await this.authorizeOverClassGroup(manager, input.classGroupId, authenticatedPersonId);

    const effective = await this.configService.resolveEffectiveConfig(input.classGroupId);

    // roomId is direct user input here (a pontual override, see
    // CreateClassSessionInput.roomId doc above) — same "validate FK exists,
    // 404 if not" precedent as SubjectService.create for courseId and
    // ClassGroupService.create for its own roomId.
    if (input.roomId) {
      await this.assertRoomExists(manager, input.roomId);
    }

    // Effective room: the input's own value when provided, else
    // class_group.roomId (RULE-INST-07) — same fallback as
    // ClassSessionService.editSession and ScheduleConflictDetectionService's
    // COALESCE. Also still validates that SOME room is resolvable when
    // input.roomId is omitted (BadRequestException below via
    // assertRoomIsResolvable) — the resolved value itself is never persisted
    // on the session, see CreateClassSessionInput.roomId doc above.
    const effectiveRoomId = input.roomId ?? (await this.assertRoomIsResolvable(manager, input.classGroupId));

    // RULE-INST-10: same conflict check already run by SessionGenerationService
    // (bulk, from the recurring grade) and editSession (pontual edit) — this
    // is the third place class_session rows get written
    // (POST /v1/class-sessions, manual creation), and must not be the one
    // gap that lets a manually created session collide on room or teacher.
    const teacherEnrollments = await manager
      .getRepository(ClassGroupEnrollmentEntity)
      .find({ where: { classGroupId: input.classGroupId, role: 'teacher' } });
    const teacherPersonIds = teacherEnrollments.map((enrollment) => enrollment.personId);

    await this.conflictDetection.assertNoConflict({
      roomId: effectiveRoomId,
      teacherPersonIds,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
    });

    const session = repository.create({
      tenantId,
      classGroupId: input.classGroupId,
      roomId: input.roomId ?? null,
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

  // Added for the admin frontend: there was no read path for existing
  // sessions — the attendance-register screens need a classSessionId to
  // look anything up, and had no way to discover one.
  async list(classGroupId?: string): Promise<ClassSessionEntity[]> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(ClassSessionEntity);
    return classGroupId
      ? repository.find({ where: { classGroupId }, order: { scheduledStart: 'DESC' } })
      : repository.find({ order: { scheduledStart: 'DESC' } });
  }

  // RULE-INST-04 (third-round update, item #1 & #2): cancels one already-
  // generated session pontually — never deletes the row, so any check-in/
  // pending-review history already attached to it (attendance_pending_review
  // .classSessionId, session_attendance_consolidation.classSessionId, etc.)
  // is preserved untouched. Authorization: Coordenador de Curso OR the
  // turma's Professor(es) responsável(is) (co-docência included,
  // RULE-INST-05) — exactly what LeadershipScopeService.hasAuthorityOverClassGroup
  // already checks, same as ClassScheduleService's montar-turma flow
  // (RULE-INST-09).
  async cancelSession(classSessionId: string, authenticatedPersonId: string): Promise<ClassSessionEntity> {
    const manager = this.tenantContext.getManager();
    const sessionRepo = manager.getRepository(ClassSessionEntity);

    const session = await sessionRepo.findOneBy({ id: classSessionId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }
    if (session.status === 'cancelled') {
      // Not an idempotency contract — a clear invalid-state error, same
      // pattern as PendingReviewService.resolve's "already resolved" check.
      throw new BadRequestException(`class_session ${classSessionId} has already been cancelled`);
    }

    await this.authorizeOverSession(manager, session, authenticatedPersonId);

    await sessionRepo.update({ id: classSessionId }, { status: 'cancelled' });
    return sessionRepo.findOneByOrFail({ id: classSessionId });
  }

  // RULE-INST-04 (third-round update, item #3): edits horário/sala/data for
  // one already-generated session, without affecting the rest of the turma's
  // schedule. Re-runs ScheduleConflictDetectionService with the NEW values
  // before saving (RULE-INST-10), excluding this same session from its own
  // conflict check. Same authorization and "cannot touch a cancelled
  // session" invalid-state rule as cancelSession above.
  async editSession(
    classSessionId: string,
    input: EditClassSessionInput,
    authenticatedPersonId: string,
  ): Promise<ClassSessionEntity> {
    if (input.scheduledEnd <= input.scheduledStart) {
      throw new BadRequestException('scheduledEnd must be after scheduledStart');
    }

    const manager = this.tenantContext.getManager();
    const sessionRepo = manager.getRepository(ClassSessionEntity);

    const session = await sessionRepo.findOneBy({ id: classSessionId });
    if (!session) {
      throw new NotFoundException(`class_session ${classSessionId} not found`);
    }
    if (session.status === 'cancelled') {
      throw new BadRequestException(`class_session ${classSessionId} is cancelled and cannot be edited`);
    }

    const classGroup = await this.authorizeOverSession(manager, session, authenticatedPersonId);

    // roomId is direct user input here (a pontual override) — same
    // "validate FK exists, 404 if not" precedent as createSession above.
    if (input.roomId) {
      await this.assertRoomExists(manager, input.roomId);
    }

    const newRoomId = input.roomId ?? session.roomId;
    // RULE-INST-07's own inheritance rule (session.roomId ?? class_group.roomId)
    // — mirrors ScheduleConflictDetectionService's COALESCE(cs.room_id, cg.room_id).
    const effectiveRoomId = newRoomId ?? classGroup.roomId;

    const teacherEnrollments = await manager
      .getRepository(ClassGroupEnrollmentEntity)
      .find({ where: { classGroupId: session.classGroupId, role: 'teacher' } });
    const teacherPersonIds = teacherEnrollments.map((enrollment) => enrollment.personId);

    await this.conflictDetection.assertNoConflict({
      classSessionIdToExclude: classSessionId,
      roomId: effectiveRoomId,
      teacherPersonIds,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
    });

    await sessionRepo.update(
      { id: classSessionId },
      {
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        roomId: newRoomId,
        status: 'edited',
      },
    );
    return sessionRepo.findOneByOrFail({ id: classSessionId });
  }

  // Shared by createSession/editSession — both accept roomId as a direct
  // user-supplied pontual override (never a value only inherited/COALESCEd
  // internally, which is what assertRoomIsResolvable below validates
  // instead).
  private async assertRoomExists(manager: EntityManager, roomId: string): Promise<void> {
    const room = await manager.getRepository(RoomEntity).findOneBy({ id: roomId });
    if (!room) {
      throw new NotFoundException(`room ${roomId} not found`);
    }
  }

  private async assertRoomIsResolvable(manager: EntityManager, classGroupId: string): Promise<string> {
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup?.roomId) {
      throw new BadRequestException(
        `class_group ${classGroupId} has no room assigned and none was provided for this session`,
      );
    }
    return classGroup.roomId;
  }

  // Shared by createSession/cancelSession/editSession — same courseId
  // derivation (one hop through the turma's subject, RULE-INST-03) and the
  // same cumulative authorization check already used by ClassScheduleService
  // (resolveClassGroupWithAuthority) and PendingReviewService.resolve
  // (RULE-ATT-12), not a fourth parallel implementation of it.
  private async authorizeOverClassGroup(
    manager: EntityManager,
    classGroupId: string,
    authenticatedPersonId: string,
  ): Promise<ClassGroupEntity> {
    // findOneBy + explicit NotFoundException here (not findOneByOrFail, which
    // the original authorizeOverSession used safely only because it always
    // started from an already-loaded session's classGroupId FK, guaranteed
    // valid) — createSession now reaches this with a raw, caller-supplied
    // classGroupId that may not exist, and that must fail with a clean 404,
    // not an uncaught TypeORM EntityNotFoundError.
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneBy({ id: classGroupId });
    if (!classGroup) {
      throw new NotFoundException(`class_group ${classGroupId} not found`);
    }
    const subject = await manager.getRepository(SubjectEntity).findOneByOrFail({ id: classGroup.subjectId });

    const authorized = await this.leadershipScope.hasAuthorityOverClassGroup(
      authenticatedPersonId,
      subject.courseId,
      classGroup.id,
    );
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${authenticatedPersonId} has no leadership authority over class_group ${classGroup.id} (RULE-INST-09)`,
      );
    }
    return classGroup;
  }

  // Thin wrapper over authorizeOverClassGroup for the two callers that start
  // from an already-loaded session rather than a bare classGroupId.
  private async authorizeOverSession(
    manager: EntityManager,
    session: ClassSessionEntity,
    authenticatedPersonId: string,
  ): Promise<ClassGroupEntity> {
    return this.authorizeOverClassGroup(manager, session.classGroupId, authenticatedPersonId);
  }
}
