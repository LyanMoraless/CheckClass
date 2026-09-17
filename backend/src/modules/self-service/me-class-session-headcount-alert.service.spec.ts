import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ClassGroupEnrollmentEntity, ClassSessionEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { MeClassSessionHeadcountAlertService } from './me-class-session-headcount-alert.service';

describe('MeClassSessionHeadcountAlertService', () => {
  const session = { id: 'session-1', tenantId: 'tenant-a-id', classGroupId: 'class-group-1' };

  function buildService(options: {
    classSessionRepo?: MockRepository;
    enrollmentRepo?: MockRepository;
    evaluateResult?: unknown;
  } = {}) {
    const classSessionRepo = options.classSessionRepo ?? createMockRepository({ findOneBy: jest.fn().mockResolvedValue(session) });
    const enrollmentRepo = options.enrollmentRepo ?? createMockRepository({ count: jest.fn().mockResolvedValue(1) });
    const manager = createMockEntityManager(
      new Map<unknown, MockRepository>([
        [ClassSessionEntity, classSessionRepo],
        [ClassGroupEnrollmentEntity, enrollmentRepo],
      ]),
    );
    const tenantContext = createMockTenantContext(manager);
    const reconciliationService = { evaluateSession: jest.fn().mockResolvedValue(options.evaluateResult ?? { classSessionId: 'session-1', inProgress: true, roomId: 'room-1', windows: [], alertActive: false }) };

    const service = new MeClassSessionHeadcountAlertService(tenantContext as never, reconciliationService as never);
    return { service, classSessionRepo, enrollmentRepo, reconciliationService };
  }

  test('test_getHeadcountAlertForAuthorizedSession_sessionNotFound_throwsNotFound', async () => {
    const classSessionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const { service } = buildService({ classSessionRepo });

    await expect(service.getHeadcountAlertForAuthorizedSession('teacher-1', 'missing-session')).rejects.toBeInstanceOf(NotFoundException);
  });

  test('test_getHeadcountAlertForAuthorizedSession_personDoesNotTeachClassGroup_throwsForbiddenWithoutEvaluating', async () => {
    const enrollmentRepo = createMockRepository({ count: jest.fn().mockResolvedValue(0) });
    const { service, reconciliationService } = buildService({ enrollmentRepo });

    await expect(service.getHeadcountAlertForAuthorizedSession('random-person', 'session-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(reconciliationService.evaluateSession).not.toHaveBeenCalled();
  });

  test('test_getHeadcountAlertForAuthorizedSession_teacherOfClassGroup_delegatesToReconciliationService', async () => {
    const evaluateResult = { classSessionId: 'session-1', inProgress: true, roomId: 'room-1', windows: [], alertActive: true };
    const { service, reconciliationService, enrollmentRepo } = buildService({ evaluateResult });

    const result = await service.getHeadcountAlertForAuthorizedSession('teacher-1', 'session-1');

    expect(enrollmentRepo.count).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-a-id', personId: 'teacher-1', classGroupId: 'class-group-1', role: 'teacher' },
    });
    expect(reconciliationService.evaluateSession).toHaveBeenCalledWith('session-1');
    expect(result).toEqual(evaluateResult);
  });
});
