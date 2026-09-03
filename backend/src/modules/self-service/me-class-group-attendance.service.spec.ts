import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClassGroupEntity, SubjectEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { MeClassGroupAttendanceService } from './me-class-group-attendance.service';

describe('MeClassGroupAttendanceService', () => {
  function buildService(options: {
    classGroup?: ClassGroupEntity | null;
    subject?: SubjectEntity;
    authorized?: boolean;
    summary?: unknown[];
  }) {
    const classGroupRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.classGroup === undefined ? { id: 'class-group-1', subjectId: 'subject-1' } : options.classGroup),
    });
    const subjectRepo = createMockRepository({
      findOneByOrFail: jest.fn().mockResolvedValue(options.subject ?? { id: 'subject-1', courseId: 'course-1' }),
    });
    const manager = createMockEntityManager(
      new Map<unknown, ReturnType<typeof createMockRepository>>([
        [ClassGroupEntity, classGroupRepo],
        [SubjectEntity, subjectRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const leadershipScope = { hasAuthorityOverClassGroup: jest.fn().mockResolvedValue(options.authorized ?? true) };
    const attendanceRegister = { getClassGroupSummary: jest.fn().mockResolvedValue(options.summary ?? []) };
    const service = new MeClassGroupAttendanceService(tenantContext as never, leadershipScope as never, attendanceRegister as never);
    return { service, classGroupRepo, subjectRepo, leadershipScope, attendanceRegister };
  }

  test('test_getAttendanceForAuthorizedClassGroup_classGroupNotFound_throwsNotFound', async () => {
    const { service } = buildService({ classGroup: null });

    await expect(service.getAttendanceForAuthorizedClassGroup('person-1', 'missing-class-group')).rejects.toThrow(NotFoundException);
  });

  test('test_getAttendanceForAuthorizedClassGroup_notInLeadershipChain_throwsForbiddenWithoutReadingAttendance', async () => {
    const { service, attendanceRegister } = buildService({ authorized: false });

    await expect(service.getAttendanceForAuthorizedClassGroup('random-person', 'class-group-1')).rejects.toThrow(ForbiddenException);
    expect(attendanceRegister.getClassGroupSummary).not.toHaveBeenCalled();
  });

  test('test_getAttendanceForAuthorizedClassGroup_authorized_resolvesCourseIdThenChecksAuthority', async () => {
    const { service, leadershipScope } = buildService({ subject: { id: 'subject-1', courseId: 'course-42' } as SubjectEntity });

    await service.getAttendanceForAuthorizedClassGroup('teacher-1', 'class-group-1');

    expect(leadershipScope.hasAuthorityOverClassGroup).toHaveBeenCalledWith('teacher-1', 'course-42', 'class-group-1');
  });

  test('test_getAttendanceForAuthorizedClassGroup_authorized_delegatesToAttendanceRegisterServiceGetClassGroupSummary', async () => {
    const summary = [{ personId: 'student-1', fullName: 'Aluno A', sessionsEvaluated: 3, presentCount: 2, absentCount: 1, pendingCount: 0, attendanceRate: 66.6 }];
    const { service, attendanceRegister } = buildService({ summary });

    const result = await service.getAttendanceForAuthorizedClassGroup('teacher-1', 'class-group-1');

    expect(attendanceRegister.getClassGroupSummary).toHaveBeenCalledWith('class-group-1');
    expect(result).toEqual(summary);
  });
});
