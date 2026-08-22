import { ClassGroupEnrollmentEntity, ClassGroupEntity } from '../../database/entities';
import {
  createMockEntityManager,
  createMockRepository,
  createMockTenantContext,
  MockRepository,
} from '../../../test/unit/support/mock-entity-manager';
import { ClassGroupService, EnrollInput } from './class-group.service';

describe('ClassGroupService', () => {
  function buildService(enrollmentRepo?: MockRepository) {
    const classGroupRepo = createMockRepository();
    const repo = enrollmentRepo ?? createMockRepository();
    const manager = createMockEntityManager(
      new Map([
        [ClassGroupEntity, classGroupRepo],
        [ClassGroupEnrollmentEntity, repo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const service = new ClassGroupService(tenantContext as never);
    return { service, classGroupRepo, enrollmentRepo: repo };
  }

  const input: EnrollInput = { classGroupId: 'class-group-1', personId: 'person-1', role: 'student' };

  test('test_enroll_notAlreadyEnrolled_savesNewEnrollment', async () => {
    const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService(enrollmentRepo);

    await service.enroll(input);

    expect(enrollmentRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ classGroupId: 'class-group-1', personId: 'person-1', role: 'student' }),
    );
  });

  test('test_enroll_alreadyEnrolled_returnsExistingWithoutDuplicateSave', async () => {
    const existing = { id: 'existing-enrollment' };
    const enrollmentRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(existing) });
    const { service } = buildService(enrollmentRepo);

    const result = await service.enroll(input);

    expect(result).toBe(existing);
    expect(enrollmentRepo.save).not.toHaveBeenCalled();
  });

  test('test_list_noCourseIdFilter_returnsAllClassGroups', async () => {
    const { service, classGroupRepo } = buildService();

    await service.list();

    expect(classGroupRepo.find).toHaveBeenCalled();
    expect(classGroupRepo.findBy).not.toHaveBeenCalled();
  });

  test('test_list_withCourseIdFilter_filtersByCourse', async () => {
    const { service, classGroupRepo } = buildService();

    await service.list('course-1');

    expect(classGroupRepo.findBy).toHaveBeenCalledWith({ courseId: 'course-1' });
  });
});
