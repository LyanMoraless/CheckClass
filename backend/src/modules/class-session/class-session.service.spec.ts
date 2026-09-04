import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  ClassGroupEntity,
  ClassGroupEnrollmentEntity,
  ClassGroupSubjectEntity,
  ClassSessionEntity,
  ClassSessionRequiredFactorEntity,
  RoomEntity,
  SubjectEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { AccumulatedFrequencyPeriod } from '../config/accumulated-frequency-period.enum';
import { ResolvedAttendanceConfig, TenantConfigService } from '../config/tenant-config.service';
import { ClassSessionService, CreateClassSessionInput, EditClassSessionInput } from './class-session.service';

// RULE-ATT-04/05: the effective config is snapshotted onto class_session at
// creation time, so a later config change never retroactively recalculates
// an already-scheduled/past session.
describe('ClassSessionService', () => {
  const baseInput: CreateClassSessionInput = {
    classGroupId: 'class-group-1',
    subjectId: 'subject-1',
    roomId: 'room-1',
    scheduledStart: new Date('2026-08-24T13:00:00Z'),
    scheduledEnd: new Date('2026-08-24T15:00:00Z'),
  };

  const resolvedConfig: ResolvedAttendanceConfig = {
    configId: 'config-1',
    minAttendancePercentage: 75,
    // Controle B's two fields (Frente 06) ride along on the resolved config
    // but are never snapshotted onto class_session — this suite is about the
    // Controle A snapshot of RULE-ATT-04/05, so they are only here to make
    // the fixture a complete ResolvedAttendanceConfig.
    minAccumulatedFrequencyPercentage: 75,
    accumulatedFrequencyPeriod: AccumulatedFrequencyPeriod.BIMESTER,
    toleranceMinutes: 10,
    postToleranceBehavior: 'block_checkin',
    requiredFactorTypeIds: [],
  };

  const subject = { id: 'subject-1', courseId: 'course-1' };
  const scheduledSession = {
    id: 'session-1',
    classGroupId: 'class-group-1',
    roomId: null as string | null,
    status: 'scheduled',
    scheduledStart: new Date('2026-09-07T13:00:00Z'),
    scheduledEnd: new Date('2026-09-07T15:00:00Z'),
  };
  const classGroupWithRoom = { id: 'class-group-1', courseId: 'course-1', roomId: 'room-1' };

  function buildService(options: {
    sessionRepo?: MockRepository;
    requiredFactorRepo?: MockRepository;
    classGroupRepo?: MockRepository;
    subjectRepo?: MockRepository;
    classGroupSubjectRepo?: MockRepository;
    enrollmentRepo?: MockRepository;
    roomRepo?: MockRepository;
    effectiveConfig?: ResolvedAttendanceConfig;
    authorized?: boolean;
    assertNoConflict?: jest.Mock;
  } = {}) {
    const sessionRepo =
      options.sessionRepo ??
      createMockRepository({
        save: jest.fn().mockResolvedValue({ id: 'session-1' }),
        findOneBy: jest.fn().mockResolvedValue(scheduledSession),
        findOneByOrFail: jest.fn().mockResolvedValue(scheduledSession),
      });
    const requiredFactorRepo = options.requiredFactorRepo ?? createMockRepository();
    const classGroupRepo =
      options.classGroupRepo ??
      createMockRepository({
        findOneBy: jest.fn().mockResolvedValue(classGroupWithRoom),
        findOneByOrFail: jest.fn().mockResolvedValue(classGroupWithRoom),
      });
    const subjectRepo =
      options.subjectRepo ?? createMockRepository({ findOneByOrFail: jest.fn().mockResolvedValue(subject) });
    const classGroupSubjectRepo =
      options.classGroupSubjectRepo ??
      createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'link-1', subjectId: 'subject-1' }) });
    const enrollmentRepo =
      options.enrollmentRepo ?? createMockRepository({ find: jest.fn().mockResolvedValue([{ personId: 'teacher-1' }]) });
    const roomRepo = options.roomRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'room-1' }) });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [ClassSessionEntity, sessionRepo],
      [ClassSessionRequiredFactorEntity, requiredFactorRepo],
      [ClassGroupEntity, classGroupRepo],
      [SubjectEntity, subjectRepo],
      [ClassGroupSubjectEntity, classGroupSubjectRepo],
      [ClassGroupEnrollmentEntity, enrollmentRepo],
      [RoomEntity, roomRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager);
    const configService = {
      resolveEffectiveConfig: jest.fn().mockResolvedValue(options.effectiveConfig ?? resolvedConfig),
    };
    const leadershipScope = { hasAuthorityOverClassGroup: jest.fn().mockResolvedValue(options.authorized ?? true) };
    const conflictDetection = { assertNoConflict: options.assertNoConflict ?? jest.fn().mockResolvedValue(undefined) };

    const service = new ClassSessionService(
      tenantContext as never,
      configService as unknown as TenantConfigService,
      leadershipScope as never,
      conflictDetection as never,
    );
    return {
      service,
      sessionRepo,
      requiredFactorRepo,
      classGroupRepo,
      subjectRepo,
      classGroupSubjectRepo,
      enrollmentRepo,
      roomRepo,
      configService,
      leadershipScope,
      conflictDetection,
    };
  }

  test('test_createSession_snapshotsResolvedConfigOntoSession', async () => {
    const { service, sessionRepo } = buildService();

    await service.createSession(baseInput, 'teacher-1');

    expect(sessionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        classGroupId: 'class-group-1',
        roomId: 'room-1',
        minAttendancePercentageSnapshot: 75,
        toleranceMinutesSnapshot: 10,
        postToleranceBehaviorSnapshot: 'block_checkin',
      }),
    );
  });

  // RULE-INST-14: the session carries the matéria it is about — without it,
  // frequência por matéria (RULE-FREQ-01) has nothing to attribute to.
  test('test_createSession_persistsTheSubjectTheSessionIsAbout', async () => {
    const { service, sessionRepo } = buildService();

    await service.createSession(baseInput, 'teacher-1');

    expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ subjectId: 'subject-1' }));
  });

  test('test_createSession_subjectNotLinkedToTheTurma_throwsBadRequestWithoutSaving', async () => {
    const classGroupSubjectRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service, sessionRepo } = buildService({ classGroupSubjectRepo });

    await expect(service.createSession({ ...baseInput, subjectId: 'subject-9' }, 'teacher-1')).rejects.toThrow(
      /RULE-INST-14/,
    );
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  test('test_createSession_noRequiredFactors_doesNotTouchRequiredFactorRepo', async () => {
    const { service, requiredFactorRepo } = buildService({ effectiveConfig: { ...resolvedConfig, requiredFactorTypeIds: [] } });

    await service.createSession(baseInput, 'teacher-1');

    expect(requiredFactorRepo.save).not.toHaveBeenCalled();
  });

  test('test_createSession_withRequiredFactors_savesOneRowPerFactor', async () => {
    const { service, requiredFactorRepo } = buildService({
      effectiveConfig: { ...resolvedConfig, requiredFactorTypeIds: ['factor-1', 'factor-2'] },
    });

    await service.createSession(baseInput, 'teacher-1');

    expect(requiredFactorRepo.save).toHaveBeenCalledWith([
      expect.objectContaining({ classSessionId: 'session-1', attendanceFactorTypeId: 'factor-1' }),
      expect.objectContaining({ classSessionId: 'session-1', attendanceFactorTypeId: 'factor-2' }),
    ]);
  });

  // RULE-INST-07: roomId is now optional on the input — omitting it means
  // "inherit class_group.roomId dynamically", persisted as NULL, not a
  // frozen snapshot of the turma's room at creation time.
  describe('createSession — optional roomId (RULE-INST-07)', () => {
    const inputWithoutRoom: CreateClassSessionInput = { ...baseInput, roomId: undefined };

    test('test_createSession_roomIdOmitted_classGroupHasRoom_savesWithNullRoomId', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'class-group-1', roomId: 'room-1' }) });
      const { service, sessionRepo } = buildService({ classGroupRepo });

      await service.createSession(inputWithoutRoom, 'teacher-1');

      expect(sessionRepo.save).toHaveBeenCalledWith(expect.objectContaining({ roomId: null }));
    });

    test('test_createSession_roomIdOmitted_classGroupHasNoRoom_throwsBadRequestWithoutSaving', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'class-group-1', roomId: null }) });
      const { service, sessionRepo } = buildService({ classGroupRepo });

      await expect(service.createSession(inputWithoutRoom, 'teacher-1')).rejects.toThrow(BadRequestException);
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    // classGroupNotFound now surfaces as NotFoundException from the RULE-INST-09
    // authorization step (authorizeOverClassGroup), which runs before room
    // resolution — a nonexistent classGroupId must fail authorization first,
    // not fall through to a room-resolution BadRequestException.
    test('test_createSession_classGroupNotFound_throwsNotFoundWithoutSaving', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, sessionRepo } = buildService({ classGroupRepo });

      await expect(service.createSession(inputWithoutRoom, 'teacher-1')).rejects.toThrow(NotFoundException);
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    // Security-review finding: createSession now always resolves class_group
    // for authorization (RULE-INST-09), even when roomId is explicitly
    // provided and room-inheritance resolution itself is skipped — so
    // classGroupRepo.findOneBy IS consulted here, exactly once (for auth),
    // never a second time (for room resolution, which doesn't run).
    test('test_createSession_roomIdProvided_consultsClassGroupRepoOnceForAuthorizationOnly', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(classGroupWithRoom) });
      const { service } = buildService({ classGroupRepo });

      await service.createSession(baseInput, 'teacher-1');

      expect(classGroupRepo.findOneBy).toHaveBeenCalledTimes(1);
    });
  });

  // RULE-INST-10: manual creation (POST /v1/class-sessions) must run the same
  // conflict check as bulk generation and pontual edit — it was the one
  // remaining gap among the three places class_session rows get written.
  describe('createSession — conflict check (RULE-INST-10)', () => {
    test('test_createSession_runsConflictCheckWithEffectiveRoomAndTurmaTeachers_beforeSaving', async () => {
      const { service, conflictDetection } = buildService();

      await service.createSession(baseInput, 'teacher-1');

      expect(conflictDetection.assertNoConflict).toHaveBeenCalledWith({
        roomId: 'room-1',
        teacherPersonIds: ['teacher-1'],
        scheduledStart: baseInput.scheduledStart,
        scheduledEnd: baseInput.scheduledEnd,
      });
    });

    test('test_createSession_roomIdOmitted_conflictCheckUsesClassGroupInheritedRoom', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'class-group-1', roomId: 'room-1' }) });
      const { service, conflictDetection } = buildService({ classGroupRepo });

      await service.createSession({ ...baseInput, roomId: undefined }, 'teacher-1');

      expect(conflictDetection.assertNoConflict).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1' }),
      );
    });

    test('test_createSession_conflictDetected_throwsAndDoesNotSave', async () => {
      const { service, sessionRepo } = buildService({
        assertNoConflict: jest.fn().mockRejectedValue(new Error('conflict')),
      });

      await expect(service.createSession(baseInput, 'teacher-1')).rejects.toThrow('conflict');
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });
  });

  // Same "validate FK exists, 404 if not" precedent as SubjectService.create
  // for courseId — roomId is direct user input here (a pontual override).
  describe('createSession — roomId existence validation', () => {
    test('test_createSession_roomIdProvided_roomDoesNotExist_throwsNotFoundWithoutSaving', async () => {
      const roomRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, sessionRepo, conflictDetection } = buildService({ roomRepo });

      await expect(service.createSession(baseInput, 'teacher-1')).rejects.toThrow(NotFoundException);
      expect(sessionRepo.save).not.toHaveBeenCalled();
      expect(conflictDetection.assertNoConflict).not.toHaveBeenCalled();
    });

    test('test_createSession_roomIdOmitted_neverConsultsRoomRepo', async () => {
      const roomRepo = createMockRepository();
      const { service } = buildService({ roomRepo });

      await service.createSession({ ...baseInput, roomId: undefined }, 'teacher-1');

      expect(roomRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  // Security-review finding: createSession was the one class_session write
  // path that skipped RULE-INST-09's cumulative leadership-scope check —
  // editSession/cancelSession already enforced it. This closes that gap.
  describe('createSession — authorization (RULE-INST-09)', () => {
    test('test_createSession_notAuthorizedOverClassGroup_throwsForbidden_beforeAnyWrite', async () => {
      const { service, sessionRepo, conflictDetection } = buildService({ authorized: false });

      await expect(service.createSession(baseInput, 'random-person')).rejects.toThrow(ForbiddenException);
      expect(sessionRepo.save).not.toHaveBeenCalled();
      expect(conflictDetection.assertNoConflict).not.toHaveBeenCalled();
    });

    test('test_createSession_derivesCourseIdThroughSubject_forAuthorityCheck', async () => {
      const { service, leadershipScope } = buildService();

      await service.createSession(baseInput, 'teacher-1');

      expect(leadershipScope.hasAuthorityOverClassGroup).toHaveBeenCalledWith('teacher-1', 'course-1', 'class-group-1');
    });
  });

  test('test_list_noClassGroupFilter_findsAllOrderedByScheduledStartDesc', async () => {
    const sessions = [{ id: 'session-1' }, { id: 'session-2' }];
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(sessions) });
    const { service } = buildService({ sessionRepo });

    const result = await service.list();

    expect(result).toBe(sessions);
    expect(sessionRepo.find).toHaveBeenCalledWith({ where: {}, order: { scheduledStart: 'DESC' } });
  });

  test('test_list_withClassGroupFilter_findsOnlyThatClassGroupsSessions', async () => {
    const sessions = [{ id: 'session-1' }];
    const sessionRepo = createMockRepository({ find: jest.fn().mockResolvedValue(sessions) });
    const { service } = buildService({ sessionRepo });

    const result = await service.list({ classGroupId: 'class-group-1' });

    expect(result).toBe(sessions);
    expect(sessionRepo.find).toHaveBeenCalledWith({
      where: { classGroupId: 'class-group-1' },
      order: { scheduledStart: 'DESC' },
    });
  });

  // RULE-INST-04 (third-round update, items #1-#2).
  describe('cancelSession', () => {
    test('test_cancelSession_scheduledSession_authorized_setsStatusCancelledWithoutDeleting', async () => {
      const { service, sessionRepo } = buildService();

      const result = await service.cancelSession('session-1', 'teacher-1');

      expect(sessionRepo.update).toHaveBeenCalledWith({ id: 'session-1' }, { status: 'cancelled' });
      expect(sessionRepo.delete).not.toHaveBeenCalled();
      expect(result).toEqual(scheduledSession);
    });

    test('test_cancelSession_alreadyCancelled_throwsBadRequestWithoutUpdating', async () => {
      const sessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ ...scheduledSession, status: 'cancelled' }) });
      const { service } = buildService({ sessionRepo });

      await expect(service.cancelSession('session-1', 'teacher-1')).rejects.toThrow(BadRequestException);
      expect(sessionRepo.update).not.toHaveBeenCalled();
    });

    test('test_cancelSession_sessionNotFound_throwsNotFound', async () => {
      const sessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ sessionRepo });

      await expect(service.cancelSession('missing-session', 'teacher-1')).rejects.toThrow(NotFoundException);
    });

    test('test_cancelSession_notAuthorized_throwsForbiddenWithoutUpdating', async () => {
      const { service, sessionRepo } = buildService({ authorized: false });

      await expect(service.cancelSession('session-1', 'random-person')).rejects.toThrow(ForbiddenException);
      expect(sessionRepo.update).not.toHaveBeenCalled();
    });

    test('test_cancelSession_derivesCourseIdThroughSubject_forAuthorityCheck', async () => {
      const { service, leadershipScope } = buildService();

      await service.cancelSession('session-1', 'teacher-1');

      expect(leadershipScope.hasAuthorityOverClassGroup).toHaveBeenCalledWith('teacher-1', 'course-1', 'class-group-1');
    });
  });

  // RULE-INST-04 (third-round update, item #3).
  describe('editSession', () => {
    const editInput: EditClassSessionInput = {
      scheduledStart: new Date('2026-09-08T13:00:00Z'),
      scheduledEnd: new Date('2026-09-08T15:00:00Z'),
    };

    test('test_editSession_authorized_runsConflictCheckAndSetsStatusEdited', async () => {
      const { service, sessionRepo, conflictDetection } = buildService();

      const result = await service.editSession('session-1', editInput, 'teacher-1');

      expect(conflictDetection.assertNoConflict).toHaveBeenCalledWith({
        classSessionIdToExclude: 'session-1',
        roomId: 'room-1', // inherited from class_group since session.roomId is null
        teacherPersonIds: ['teacher-1'],
        scheduledStart: editInput.scheduledStart,
        scheduledEnd: editInput.scheduledEnd,
      });
      expect(sessionRepo.update).toHaveBeenCalledWith(
        { id: 'session-1' },
        { scheduledStart: editInput.scheduledStart, scheduledEnd: editInput.scheduledEnd, roomId: null, status: 'edited' },
      );
      expect(result).toEqual(scheduledSession);
    });

    test('test_editSession_roomIdProvided_overridesInheritedRoomForConflictCheckAndSave', async () => {
      const { service, sessionRepo, conflictDetection } = buildService();

      await service.editSession('session-1', { ...editInput, roomId: 'room-2' }, 'teacher-1');

      expect(conflictDetection.assertNoConflict).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-2' }));
      expect(sessionRepo.update).toHaveBeenCalledWith(
        { id: 'session-1' },
        expect.objectContaining({ roomId: 'room-2', status: 'edited' }),
      );
    });

    test('test_editSession_roomIdOmitted_alreadyHasPontualOverride_keepsExistingOverride', async () => {
      const sessionRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ ...scheduledSession, roomId: 'room-override' }),
        findOneByOrFail: jest.fn().mockResolvedValue({ ...scheduledSession, roomId: 'room-override' }),
      });
      const { service, conflictDetection } = buildService({ sessionRepo });

      await service.editSession('session-1', editInput, 'teacher-1');

      expect(conflictDetection.assertNoConflict).toHaveBeenCalledWith(expect.objectContaining({ roomId: 'room-override' }));
    });

    test('test_editSession_endNotAfterStart_throwsBadRequestBeforeAnyQuery', async () => {
      const { service, sessionRepo } = buildService();

      await expect(
        service.editSession('session-1', { scheduledStart: editInput.scheduledStart, scheduledEnd: editInput.scheduledStart }, 'teacher-1'),
      ).rejects.toThrow(BadRequestException);
      expect(sessionRepo.findOneBy).not.toHaveBeenCalled();
    });

    test('test_editSession_sessionCancelled_throwsBadRequestWithoutConflictCheck', async () => {
      const sessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ ...scheduledSession, status: 'cancelled' }) });
      const { service, conflictDetection } = buildService({ sessionRepo });

      await expect(service.editSession('session-1', editInput, 'teacher-1')).rejects.toThrow(BadRequestException);
      expect(conflictDetection.assertNoConflict).not.toHaveBeenCalled();
    });

    test('test_editSession_sessionNotFound_throwsNotFound', async () => {
      const sessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ sessionRepo });

      await expect(service.editSession('missing-session', editInput, 'teacher-1')).rejects.toThrow(NotFoundException);
    });

    test('test_editSession_notAuthorized_throwsForbiddenWithoutConflictCheck', async () => {
      const { service, conflictDetection } = buildService({ authorized: false });

      await expect(service.editSession('session-1', editInput, 'random-person')).rejects.toThrow(ForbiddenException);
      expect(conflictDetection.assertNoConflict).not.toHaveBeenCalled();
    });

    test('test_editSession_conflictDetected_throwsAndDoesNotUpdate', async () => {
      const { service, sessionRepo } = buildService({
        assertNoConflict: jest.fn().mockRejectedValue(new Error('conflict')),
      });

      await expect(service.editSession('session-1', editInput, 'teacher-1')).rejects.toThrow('conflict');
      expect(sessionRepo.update).not.toHaveBeenCalled();
    });

    // Same "validate FK exists, 404 if not" precedent as createSession above.
    test('test_editSession_roomIdProvided_roomDoesNotExist_throwsNotFoundWithoutUpdating', async () => {
      const roomRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, sessionRepo, conflictDetection } = buildService({ roomRepo });

      await expect(service.editSession('session-1', { ...editInput, roomId: 'room-2' }, 'teacher-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(sessionRepo.update).not.toHaveBeenCalled();
      expect(conflictDetection.assertNoConflict).not.toHaveBeenCalled();
    });

    test('test_editSession_roomIdOmitted_neverConsultsRoomRepo', async () => {
      const roomRepo = createMockRepository();
      const { service } = buildService({ roomRepo });

      await service.editSession('session-1', editInput, 'teacher-1');

      expect(roomRepo.findOneBy).not.toHaveBeenCalled();
    });
  });
});
