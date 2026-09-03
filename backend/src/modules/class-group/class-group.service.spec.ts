import {
  ClassGroupEnrollmentEntity,
  ClassGroupEntity,
  ClassGroupSubjectEntity,
  CourseEntity,
  LeadershipAssignmentEntity,
  LeadershipRoleEntity,
  RoomEntity,
  SubjectEntity,
} from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import {
  ClassGroupService,
  CreateClassGroupInput,
  EnrollInput,
  UnenrollInput,
  UpdateEnrollmentStatusInput,
} from './class-group.service';

// RULE-INST-09 (cumulative leadership-scope authorization for montar/editar
// turma) and RULE-INST-05 (assigning/removing a teacher grants/revokes
// pending-review resolution authority automatically, in the same
// request). LeadershipScopeService itself is mocked — its own branch
// coverage lives in leadership-scope.service.spec.ts.
describe('ClassGroupService', () => {
  const subject = { id: 'subject-1', courseId: 'course-1' };
  const classGroup = { id: 'class-group-1', courseId: 'course-1' };
  const professorRole = { id: 'leadership-role-professor', name: 'Professor' };

  function buildService(options: {
    authorized?: boolean;
    classGroupRepo?: MockRepository;
    subjectRepo?: MockRepository;
    enrollmentRepo?: MockRepository;
    leadershipRepo?: MockRepository;
    leadershipRoleRepo?: MockRepository;
    roomRepo?: MockRepository;
    courseRepo?: MockRepository;
    classGroupSubjectRepo?: MockRepository;
  } = {}) {
    const classGroupRepo =
      options.classGroupRepo ??
      createMockRepository({
        findOneBy: jest.fn().mockResolvedValue(classGroup),
        // create() alone can't produce an id, and RULE-INST-14's subject
        // linking happens right after the turma is saved — so the save mock
        // has to hand back a persisted-looking row, id included.
        save: jest.fn((entity: unknown) => Promise.resolve({ id: 'class-group-1', ...(entity as object) })),
      });
    const subjectRepo =
      options.subjectRepo ??
      createMockRepository({
        findOneBy: jest.fn().mockResolvedValue(subject),
        findOneByOrFail: jest.fn().mockResolvedValue(subject),
      });
    const enrollmentRepo = options.enrollmentRepo ?? createMockRepository();
    const leadershipRepo = options.leadershipRepo ?? createMockRepository();
    const leadershipRoleRepo =
      options.leadershipRoleRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(professorRole) });
    const roomRepo = options.roomRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'room-1' }) });
    const courseRepo =
      options.courseRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue({ id: 'course-1' }) });
    const classGroupSubjectRepo =
      options.classGroupSubjectRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });

    const manager = createMockEntityManager(
      new Map([
        [ClassGroupEntity, classGroupRepo],
        [SubjectEntity, subjectRepo],
        [ClassGroupEnrollmentEntity, enrollmentRepo],
        [LeadershipAssignmentEntity, leadershipRepo],
        [LeadershipRoleEntity, leadershipRoleRepo],
        [RoomEntity, roomRepo],
        [CourseEntity, courseRepo],
        [ClassGroupSubjectEntity, classGroupSubjectRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const leadershipScope = {
      hasAuthorityOverClassGroup: jest.fn().mockResolvedValue(options.authorized ?? true),
      hasAuthorityOverCourse: jest.fn().mockResolvedValue(options.authorized ?? true),
    };
    const deletionOrchestrator = {
      deleteClassGroup: jest.fn().mockResolvedValue(undefined),
      assertSubjectRemovable: jest.fn().mockResolvedValue(undefined),
      removeSubjectFromClassGroup: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ClassGroupService(tenantContext as never, leadershipScope as never, deletionOrchestrator as never);
    return {
      service,
      classGroupRepo,
      subjectRepo,
      enrollmentRepo,
      leadershipRepo,
      leadershipRoleRepo,
      roomRepo,
      courseRepo,
      classGroupSubjectRepo,
      leadershipScope,
      deletionOrchestrator,
    };
  }

  describe('create', () => {
    const input: CreateClassGroupInput = { courseId: 'course-1', name: 'Turma A' };

    test('test_create_authorizedOverCourse_savesNewClassGroup', async () => {
      const { service, classGroupRepo } = buildService({ authorized: true });

      await service.create(input, 'coordinator-1');

      expect(classGroupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ courseId: 'course-1', name: 'Turma A', roomId: null, termStartDate: null, termEndDate: null }),
      );
    });

    // RULE-INST-14: a turma is created under a Curso and composed with N
    // matérias — the set is optional here on purpose, and an omitted one
    // leaves a perfectly valid turma with no matéria yet.
    test('test_create_withSubjectIds_linksEachSubjectToTheNewClassGroup', async () => {
      const { service, classGroupSubjectRepo } = buildService({ authorized: true });

      await service.create({ ...input, subjectIds: ['subject-1', 'subject-2'] }, 'coordinator-1');

      expect(classGroupSubjectRepo.save).toHaveBeenCalledTimes(2);
      expect(classGroupSubjectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ classGroupId: 'class-group-1', subjectId: 'subject-1' }),
      );
      expect(classGroupSubjectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ classGroupId: 'class-group-1', subjectId: 'subject-2' }),
      );
    });

    test('test_create_repeatedSubjectIdInInput_linksItOnlyOnce', async () => {
      const { service, classGroupSubjectRepo } = buildService({ authorized: true });

      await service.create({ ...input, subjectIds: ['subject-1', 'subject-1'] }, 'coordinator-1');

      expect(classGroupSubjectRepo.save).toHaveBeenCalledTimes(1);
    });

    test('test_create_noSubjectIds_savesTurmaWithoutLinkingAnySubject', async () => {
      const { service, classGroupRepo, classGroupSubjectRepo } = buildService({ authorized: true });

      await service.create(input, 'coordinator-1');

      expect(classGroupRepo.save).toHaveBeenCalled();
      expect(classGroupSubjectRepo.save).not.toHaveBeenCalled();
    });

    // RULE-INST-14: a turma may only study matérias of its own course.
    test('test_create_subjectFromAnotherCourse_throwsBadRequest', async () => {
      const subjectRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'subject-x', courseId: 'course-other' }),
      });
      const { service } = buildService({ subjectRepo });

      await expect(service.create({ ...input, subjectIds: ['subject-x'] }, 'coordinator-1')).rejects.toThrow(
        /RULE-INST-14/,
      );
    });

    test('test_create_passesThroughOptionalRoomAndTermDates', async () => {
      const { service, classGroupRepo } = buildService({ authorized: true });

      await service.create(
        { ...input, roomId: 'room-1', termStartDate: '2026-02-01', termEndDate: '2026-06-30' },
        'coordinator-1',
      );

      expect(classGroupRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ roomId: 'room-1', termStartDate: new Date('2026-02-01'), termEndDate: new Date('2026-06-30') }),
      );
    });

    test('test_create_notAuthorizedOverCourse_throwsForbidden', async () => {
      const { service, leadershipScope } = buildService({ authorized: false });

      await expect(service.create(input, 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(leadershipScope.hasAuthorityOverCourse).toHaveBeenCalledWith('random-person', 'course-1');
    });

    test('test_create_courseNotFound_throwsNotFound', async () => {
      const courseRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ courseRepo });

      await expect(service.create(input, 'coordinator-1')).rejects.toThrow(/course course-1 not found/);
    });

    test('test_create_subjectNotFound_throwsNotFound', async () => {
      const subjectRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ subjectRepo });

      await expect(service.create({ ...input, subjectIds: ['subject-1'] }, 'coordinator-1')).rejects.toThrow(
        /subject subject-1 not found/,
      );
    });

    // Same "validate FK exists, 404 if not" precedent as SubjectService.create
    // for courseId — roomId is direct user input on turma creation.
    test('test_create_roomIdProvided_roomDoesNotExist_throwsNotFoundWithoutSaving', async () => {
      const roomRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service, classGroupRepo } = buildService({ roomRepo });

      await expect(service.create({ ...input, roomId: 'missing-room' }, 'coordinator-1')).rejects.toThrow(
        /room missing-room not found/,
      );
      expect(classGroupRepo.save).not.toHaveBeenCalled();
    });

    test('test_create_roomIdOmitted_neverConsultsRoomRepo', async () => {
      const roomRepo = createMockRepository();
      const { service } = buildService({ roomRepo });

      await service.create(input, 'coordinator-1');

      expect(roomRepo.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    test('test_list_noFilter_returnsAllClassGroups', async () => {
      const { service, classGroupRepo } = buildService();

      await service.list();

      expect(classGroupRepo.find).toHaveBeenCalled();
      expect(classGroupRepo.findBy).not.toHaveBeenCalled();
    });

    test('test_list_withCourseIdFilter_filtersByCourse', async () => {
      const { service, classGroupRepo } = buildService();

      await service.list({ courseId: 'course-1' });

      expect(classGroupRepo.findBy).toHaveBeenCalledWith({ courseId: 'course-1' });
    });

    // RULE-INST-14: "turmas desta matéria" is now a join through
    // class_group_subject, not a column filter on the turma.
    test('test_list_withSubjectIdFilter_resolvesClassGroupsThroughTheJunctionTable', async () => {
      const classGroupSubjectRepo = createMockRepository({
        find: jest.fn().mockResolvedValue([{ classGroupId: 'class-group-1' }, { classGroupId: 'class-group-2' }]),
      });
      const { service, classGroupRepo } = buildService({ classGroupSubjectRepo });

      await service.list({ subjectId: 'subject-1' });

      expect(classGroupSubjectRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { subjectId: 'subject-1' } }),
      );
      expect(classGroupRepo.findBy).toHaveBeenCalledWith({ id: expect.anything() });
    });

    // RULE-INST-14: the list screen shows a SET of matérias per turma, so
    // each row carries its subjectIds — including an empty one for a turma
    // that currently has no matéria.
    test('test_list_attachesEachTurmasSubjectIds_emptyArrayForATurmaWithNone', async () => {
      const classGroupRepo = createMockRepository({
        find: jest.fn().mockResolvedValue([{ id: 'class-group-1' }, { id: 'class-group-2' }]),
      });
      const classGroupSubjectRepo = createMockRepository({
        findBy: jest.fn().mockResolvedValue([
          { classGroupId: 'class-group-1', subjectId: 'subject-1' },
          { classGroupId: 'class-group-1', subjectId: 'subject-2' },
        ]),
      });
      const { service } = buildService({ classGroupRepo, classGroupSubjectRepo });

      const result = await service.list();

      expect(result).toEqual([
        { id: 'class-group-1', subjectIds: ['subject-1', 'subject-2'] },
        { id: 'class-group-2', subjectIds: [] },
      ]);
    });

    test('test_list_withSubjectIdFilter_noTurmaStudiesIt_returnsEmptyWithoutQueryingClassGroups', async () => {
      const classGroupSubjectRepo = createMockRepository({ find: jest.fn().mockResolvedValue([]) });
      const { service, classGroupRepo } = buildService({ classGroupSubjectRepo });

      const result = await service.list({ subjectId: 'subject-1' });

      expect(result).toEqual([]);
      expect(classGroupRepo.findBy).not.toHaveBeenCalled();
      expect(classGroupRepo.find).not.toHaveBeenCalled();
    });
  });

  // RULE-INST-14 / RULE-INST-08 addendum: the turma's set of matérias is
  // editable after creation, and emptying it completely is allowed.
  describe('subjects', () => {
    test('test_addSubject_authorized_linksSubjectToClassGroup', async () => {
      const { service, classGroupSubjectRepo } = buildService({ authorized: true });

      await service.addSubject('class-group-1', 'subject-1', 'coordinator-1');

      expect(classGroupSubjectRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ classGroupId: 'class-group-1', subjectId: 'subject-1' }),
      );
    });

    test('test_addSubject_alreadyLinked_returnsExistingWithoutDuplicateSave', async () => {
      const existing = { id: 'link-1', classGroupId: 'class-group-1', subjectId: 'subject-1' };
      const classGroupSubjectRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(existing) });
      const { service } = buildService({ classGroupSubjectRepo });

      const result = await service.addSubject('class-group-1', 'subject-1', 'coordinator-1');

      expect(result).toBe(existing);
      expect(classGroupSubjectRepo.save).not.toHaveBeenCalled();
    });

    test('test_addSubject_notAuthorizedOverClassGroup_throwsForbiddenWithoutLinking', async () => {
      const { service, classGroupSubjectRepo } = buildService({ authorized: false });

      await expect(service.addSubject('class-group-1', 'subject-1', 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(classGroupSubjectRepo.save).not.toHaveBeenCalled();
    });

    test('test_removeSubject_linked_delegatesRemovalToOrchestrator', async () => {
      const classGroupSubjectRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'link-1' }),
      });
      const { service, deletionOrchestrator } = buildService({ classGroupSubjectRepo });

      await service.removeSubject('class-group-1', 'subject-1', 'coordinator-1');

      expect(deletionOrchestrator.assertSubjectRemovable).toHaveBeenCalledWith('class-group-1', 'subject-1');
      expect(deletionOrchestrator.removeSubjectFromClassGroup).toHaveBeenCalledWith(
        expect.anything(),
        'class-group-1',
        'subject-1',
      );
    });

    test('test_removeSubject_notLinked_throwsNotFound', async () => {
      const { service, deletionOrchestrator } = buildService();

      await expect(service.removeSubject('class-group-1', 'subject-9', 'coordinator-1')).rejects.toThrow(
        /subject subject-9 is not linked to class_group class-group-1/,
      );
      expect(deletionOrchestrator.removeSubjectFromClassGroup).not.toHaveBeenCalled();
    });

    test('test_removeSubject_notAuthorizedOverClassGroup_throwsForbiddenWithoutRemoving', async () => {
      const classGroupSubjectRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'link-1' }),
      });
      const { service, deletionOrchestrator } = buildService({ authorized: false, classGroupSubjectRepo });

      await expect(service.removeSubject('class-group-1', 'subject-1', 'random-person')).rejects.toThrow(
        /RULE-INST-09/,
      );
      expect(deletionOrchestrator.removeSubjectFromClassGroup).not.toHaveBeenCalled();
    });
  });

  describe('enroll', () => {
    const studentInput: EnrollInput = { classGroupId: 'class-group-1', personId: 'student-1', role: 'student' };
    const teacherInput: EnrollInput = { classGroupId: 'class-group-1', personId: 'teacher-1', role: 'teacher' };

    test('test_enroll_notAlreadyEnrolled_savesNewEnrollment', async () => {
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ enrollmentRepo });

      await service.enroll(studentInput, 'coordinator-1');

      expect(enrollmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ classGroupId: 'class-group-1', personId: 'student-1', role: 'student' }),
      );
    });

    test('test_enroll_alreadyEnrolled_returnsExistingWithoutDuplicateSave', async () => {
      const existing = { id: 'existing-enrollment' };
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(existing) });
      const { service } = buildService({ enrollmentRepo });

      const result = await service.enroll(studentInput, 'coordinator-1');

      expect(result).toBe(existing);
      expect(enrollmentRepo.save).not.toHaveBeenCalled();
    });

    test('test_enroll_notAuthorizedOverClassGroup_throwsForbidden_beforeTouchingEnrollments', async () => {
      const enrollmentRepo = createMockRepository();
      const { service } = buildService({ authorized: false, enrollmentRepo });

      await expect(service.enroll(studentInput, 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(enrollmentRepo.save).not.toHaveBeenCalled();
    });

    test('test_enroll_studentRole_doesNotGrantLeadershipAssignment', async () => {
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const leadershipRepo = createMockRepository();
      const { service } = buildService({ enrollmentRepo, leadershipRepo });

      await service.enroll(studentInput, 'coordinator-1');

      expect(leadershipRepo.save).not.toHaveBeenCalled();
    });

    // RULE-INST-05: assigning a teacher automatically grants class_group
    // -scoped pending-review resolution authority (RULE-ATT-12).
    test('test_enroll_teacherRole_newEnrollment_grantsClassGroupScopedLeadershipAssignment', async () => {
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const leadershipRepo = createMockRepository();
      const { service } = buildService({ enrollmentRepo, leadershipRepo });

      await service.enroll(teacherInput, 'coordinator-1');

      expect(leadershipRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          personId: 'teacher-1',
          leadershipRoleId: 'leadership-role-professor',
          courseId: 'course-1',
          classGroupId: 'class-group-1',
        }),
      );
    });

    test('test_enroll_teacherRole_alreadyEnrolled_doesNotRegrantLeadership', async () => {
      // Idempotency: enroll() short-circuits on an existing enrollment
      // before ever reaching the leadership-grant step — retries can't
      // double-grant.
      const existing = { id: 'existing-enrollment', role: 'teacher' };
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(existing) });
      const leadershipRepo = createMockRepository();
      const { service } = buildService({ enrollmentRepo, leadershipRepo });

      await service.enroll(teacherInput, 'coordinator-1');

      expect(leadershipRepo.save).not.toHaveBeenCalled();
    });

    test('test_enroll_teacherRole_noProfessorLeadershipRoleRegistered_throwsNotFound', async () => {
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const leadershipRoleRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ enrollmentRepo, leadershipRoleRepo });

      await expect(service.enroll(teacherInput, 'coordinator-1')).rejects.toThrow(/leadership_role "Professor" not found/);
    });
  });

  describe('unenroll', () => {
    const unenrollTeacherInput: UnenrollInput = { classGroupId: 'class-group-1', personId: 'teacher-1' };
    const unenrollStudentInput: UnenrollInput = { classGroupId: 'class-group-1', personId: 'student-1' };

    test('test_unenroll_notEnrolled_throwsNotFound', async () => {
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ enrollmentRepo });

      await expect(service.unenroll(unenrollStudentInput, 'coordinator-1')).rejects.toThrow(/class_group_enrollment.*not found/);
    });

    test('test_unenroll_notAuthorizedOverClassGroup_throwsForbidden_beforeDeletingAnything', async () => {
      const enrollmentRepo = createMockRepository();
      const leadershipRepo = createMockRepository();
      const { service } = buildService({ authorized: false, enrollmentRepo, leadershipRepo });

      await expect(service.unenroll(unenrollTeacherInput, 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(enrollmentRepo.delete).not.toHaveBeenCalled();
      expect(leadershipRepo.delete).not.toHaveBeenCalled();
    });

    test('test_unenroll_studentRole_removesEnrollmentOnly_noLeadershipRevocation', async () => {
      const enrollmentRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'enrollment-1', role: 'student' }),
      });
      const leadershipRepo = createMockRepository();
      const { service } = buildService({ enrollmentRepo, leadershipRepo });

      await service.unenroll(unenrollStudentInput, 'coordinator-1');

      expect(enrollmentRepo.delete).toHaveBeenCalledWith({ id: 'enrollment-1' });
      expect(leadershipRepo.delete).not.toHaveBeenCalled();
    });

    // RULE-INST-05, second round: removing a teacher revokes exactly the
    // class_group-scoped assignment their enrollment granted — never a
    // broader course-wide/institution-wide assignment.
    test('test_unenroll_teacherRole_removesEnrollmentAndRevokesClassGroupScopedLeadershipOnly', async () => {
      const enrollmentRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'enrollment-1', role: 'teacher' }),
      });
      const leadershipRepo = createMockRepository();
      const { service } = buildService({ enrollmentRepo, leadershipRepo });

      await service.unenroll(unenrollTeacherInput, 'coordinator-1');

      expect(enrollmentRepo.delete).toHaveBeenCalledWith({ id: 'enrollment-1' });
      expect(leadershipRepo.delete).toHaveBeenCalledWith({
        personId: 'teacher-1',
        courseId: 'course-1',
        classGroupId: 'class-group-1',
      });
    });

    test('test_unenroll_classGroupNotFound_throwsNotFound', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ classGroupRepo });

      await expect(service.unenroll(unenrollTeacherInput, 'coordinator-1')).rejects.toThrow(/class_group class-group-1 not found/);
    });
  });

  // RULE-INST-11: free transitions between the four enrollment_status
  // values, no state machine — any value can become any other.
  describe('updateEnrollmentStatus', () => {
    const statusInput: UpdateEnrollmentStatusInput = {
      classGroupId: 'class-group-1',
      personId: 'student-1',
      status: 'on_leave',
    };

    test('test_updateEnrollmentStatus_authorized_updatesAndReturnsEnrollment', async () => {
      const updated = { id: 'enrollment-1', enrollmentStatus: 'on_leave' };
      const enrollmentRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'enrollment-1', role: 'student', enrollmentStatus: 'active' }),
        findOneByOrFail: jest.fn().mockResolvedValue(updated),
      });
      const { service } = buildService({ enrollmentRepo });

      const result = await service.updateEnrollmentStatus(statusInput, 'coordinator-1');

      expect(enrollmentRepo.update).toHaveBeenCalledWith({ id: 'enrollment-1' }, { enrollmentStatus: 'on_leave' });
      expect(result).toBe(updated);
    });

    // No state machine — any value is a valid transition from any other,
    // including e.g. graduated -> active.
    test('test_updateEnrollmentStatus_anyValueToAnyOther_noTransitionRestriction', async () => {
      const enrollmentRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'enrollment-1', role: 'student', enrollmentStatus: 'graduated' }),
      });
      const { service } = buildService({ enrollmentRepo });

      await service.updateEnrollmentStatus({ ...statusInput, status: 'active' }, 'coordinator-1');

      expect(enrollmentRepo.update).toHaveBeenCalledWith({ id: 'enrollment-1' }, { enrollmentStatus: 'active' });
    });

    test('test_updateEnrollmentStatus_notAuthorizedOverClassGroup_throwsForbiddenWithoutUpdating', async () => {
      const enrollmentRepo = createMockRepository();
      const { service } = buildService({ authorized: false, enrollmentRepo });

      await expect(service.updateEnrollmentStatus(statusInput, 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(enrollmentRepo.update).not.toHaveBeenCalled();
    });

    test('test_updateEnrollmentStatus_enrollmentNotFound_throwsNotFound', async () => {
      const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ enrollmentRepo });

      await expect(service.updateEnrollmentStatus(statusInput, 'coordinator-1')).rejects.toThrow(
        /class_group_enrollment.*not found/,
      );
    });

    test('test_updateEnrollmentStatus_classGroupNotFound_throwsNotFound', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ classGroupRepo });

      await expect(service.updateEnrollmentStatus(statusInput, 'coordinator-1')).rejects.toThrow(
        /class_group class-group-1 not found/,
      );
    });
  });

  // RULE-INST-08/13: deletion itself is delegated to
  // ClassGroupDeletionOrchestrator (its own attendance-activity/cascade
  // branch coverage lives in class-group-deletion-orchestrator.service.spec.ts)
  // — this service's own responsibility is just the RULE-INST-09 authority
  // check before delegating.
  describe('delete', () => {
    test('test_delete_authorizedOverClassGroup_delegatesToOrchestrator', async () => {
      const { service, deletionOrchestrator } = buildService({ authorized: true });

      await service.delete('class-group-1', 'coordinator-1');

      expect(deletionOrchestrator.deleteClassGroup).toHaveBeenCalledWith('class-group-1');
    });

    test('test_delete_notAuthorizedOverClassGroup_throwsForbidden_beforeDelegating', async () => {
      const { service, deletionOrchestrator } = buildService({ authorized: false });

      await expect(service.delete('class-group-1', 'random-person')).rejects.toThrow(/RULE-INST-09/);
      expect(deletionOrchestrator.deleteClassGroup).not.toHaveBeenCalled();
    });

    test('test_delete_classGroupNotFound_throwsNotFound', async () => {
      const classGroupRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ classGroupRepo });

      await expect(service.delete('class-group-1', 'coordinator-1')).rejects.toThrow(/class_group class-group-1 not found/);
    });
  });
});
