import { NotFoundException } from '@nestjs/common';
import { CourseEntity, LeadershipAssignmentEntity, LeadershipRoleEntity, PersonEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { CourseCoordinatorAssignmentService } from './course-coordinator-assignment.service';

describe('CourseCoordinatorAssignmentService', () => {
  function buildService(options: {
    person?: PersonEntity | null;
    course?: CourseEntity | null;
    role?: LeadershipRoleEntity | null;
    existingAssignment?: LeadershipAssignmentEntity | null;
    assignmentRepo?: MockRepository;
    listRows?: unknown[];
  }) {
    const personRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.person === undefined ? { id: 'person-1' } : options.person),
    });
    const courseRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(options.course === undefined ? { id: 'course-1' } : options.course),
    });
    const roleRepo = createMockRepository({
      findOneBy: jest
        .fn()
        .mockResolvedValue(options.role === undefined ? { id: 'coordinator-role-1', name: 'Coordenador de Curso' } : options.role),
    });
    const assignmentRepo =
      options.assignmentRepo ??
      createMockRepository({
        findOneBy: jest.fn().mockResolvedValue(options.existingAssignment ?? null),
      });

    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([
        [PersonEntity, personRepo],
        [CourseEntity, courseRepo],
        [LeadershipRoleEntity, roleRepo],
        [LeadershipAssignmentEntity, assignmentRepo],
      ]),
    );
    manager.query.mockResolvedValue(options.listRows ?? []);
    const tenantContext = createMockTenantContext(manager);
    const service = new CourseCoordinatorAssignmentService(tenantContext as never);
    return { service, personRepo, courseRepo, roleRepo, assignmentRepo, manager };
  }

  describe('assign', () => {
    test('test_assign_personNotFound_throwsNotFound', async () => {
      const { service } = buildService({ person: null });

      await expect(service.assign({ personId: 'missing-person', courseId: 'course-1' })).rejects.toThrow(/person missing-person not found/);
    });

    test('test_assign_courseNotFound_throwsNotFound', async () => {
      const { service } = buildService({ course: null });

      await expect(service.assign({ personId: 'person-1', courseId: 'missing-course' })).rejects.toThrow(/course missing-course not found/);
    });

    test('test_assign_coordinatorRoleNotSeededForTenant_throwsNotFound', async () => {
      const { service } = buildService({ role: null });

      await expect(service.assign({ personId: 'person-1', courseId: 'course-1' })).rejects.toThrow(/leadership_role "Coordenador de Curso" not found/);
    });

    test('test_assign_alreadyCoordinatorOfThisCourse_returnsExistingAssignmentWithoutCreatingAnother', async () => {
      const existing = { id: 'assignment-1', personId: 'person-1', courseId: 'course-1' } as LeadershipAssignmentEntity;
      const { service, assignmentRepo } = buildService({ existingAssignment: existing });

      const result = await service.assign({ personId: 'person-1', courseId: 'course-1' });

      expect(result).toBe(existing);
      expect(assignmentRepo.save).not.toHaveBeenCalled();
    });

    test('test_assign_newAssignment_savesWithCourseWideScopeAndNullClassGroupId', async () => {
      const { service, assignmentRepo } = buildService({});

      await service.assign({ personId: 'person-1', courseId: 'course-1' });

      expect(assignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-a-id',
          personId: 'person-1',
          leadershipRoleId: 'coordinator-role-1',
          courseId: 'course-1',
          classGroupId: null,
        }),
      );
    });
  });

  describe('list', () => {
    test('test_list_queriesScopedToCoordinatorRoleNameOnly', async () => {
      const { service, manager } = buildService({});

      await service.list();

      expect(manager.query).toHaveBeenCalledWith(expect.any(String), ['tenant-a-id', 'Coordenador de Curso']);
    });

    test('test_list_returnsRowsResolvedFromTheQuery', async () => {
      const rows = [{ id: 'assignment-1', personId: 'person-1', personFullName: 'Ana', courseId: 'course-1', courseName: 'Eng', createdAt: new Date() }];
      const { service } = buildService({ listRows: rows });

      const result = await service.list();

      expect(result).toEqual(rows);
    });
  });

  describe('revoke', () => {
    test('test_revoke_assignmentNotFoundOrWrongRole_throwsNotFound', async () => {
      const assignmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
      const { service } = buildService({ assignmentRepo });

      await expect(service.revoke('missing-assignment')).rejects.toThrow(NotFoundException);
    });

    test('test_revoke_scopesLookupToCoordinatorRoleId', async () => {
      const assignmentRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'assignment-1', leadershipRoleId: 'coordinator-role-1' }),
      });
      const { service, assignmentRepo: repo } = buildService({ assignmentRepo });

      await service.revoke('assignment-1');

      expect(repo.findOneBy).toHaveBeenCalledWith({ id: 'assignment-1', leadershipRoleId: 'coordinator-role-1' });
      expect(repo.delete).toHaveBeenCalledWith({ id: 'assignment-1' });
    });
  });
});
