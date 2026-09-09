import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AbsenceJustificationItemEntity, AbsenceJustificationSubmissionEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { AbsenceJustificationSubmissionService } from './absence-justification-submission.service';

describe('AbsenceJustificationSubmissionService', () => {
  const VALID_FILE = { originalname: 'atestado.pdf', mimetype: 'application/pdf', size: 1024, buffer: Buffer.from('x') } as Express.Multer.File;
  const VALID_DTO = {
    startDate: '2026-09-01',
    endDate: '2026-09-01',
    legalCategory: 'illness_temporary_incapacity' as const,
    description: 'Gripe forte',
  };

  function buildService(eligible: unknown[] = [{ classSessionId: 'session-1', classGroupId: 'class-group-1', subjectId: 'subject-1', scheduledStart: new Date() }]) {
    const submissionRepo = createMockRepository({ findOneBy: jest.fn().mockResolvedValue(null) });
    const itemRepo = createMockRepository({ findBy: jest.fn().mockResolvedValue([]) });
    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AbsenceJustificationSubmissionEntity, submissionRepo],
      [AbsenceJustificationItemEntity, itemRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const eligibility = { deriveEligibleSessions: jest.fn().mockResolvedValue({ eligible, excluded: [] }) };
    const attachmentService = {
      assertUploadIsAcceptable: jest.fn(),
      uploadForSubmission: jest.fn().mockResolvedValue(undefined),
      recomputeRetentionSchedule: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AbsenceJustificationSubmissionService(tenantContext as never, eligibility as never, attachmentService as never);
    return { service, submissionRepo, itemRepo, eligibility, attachmentService };
  }

  describe('create', () => {
    test('test_create_noFile_throwsBadRequest', async () => {
      const { service } = buildService();
      await expect(service.create('student-1', VALID_DTO, undefined)).rejects.toThrow(BadRequestException);
    });

    test('test_create_endBeforeStart_throwsBadRequest', async () => {
      const { service } = buildService();
      await expect(
        service.create('student-1', { ...VALID_DTO, startDate: '2026-09-05', endDate: '2026-09-01' }, VALID_FILE),
      ).rejects.toThrow(BadRequestException);
    });

    // RULE-JUST-14: zero eligible sessions refuses the whole request and the
    // attachment is NEVER stored.
    test('test_create_noEligibleSessions_throwsAndNeverUploads', async () => {
      const { service, attachmentService } = buildService([]);

      await expect(service.create('student-1', VALID_DTO, VALID_FILE)).rejects.toThrow(BadRequestException);
      expect(attachmentService.uploadForSubmission).not.toHaveBeenCalled();
    });

    test('test_create_eligibleSessions_persistsSubmissionItemsThenUploads', async () => {
      const { service, submissionRepo, itemRepo, attachmentService } = buildService();

      const result = await service.create('student-1', VALID_DTO, VALID_FILE);

      expect(submissionRepo.save).toHaveBeenCalled();
      expect(itemRepo.save).toHaveBeenCalled();
      expect(attachmentService.uploadForSubmission).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
    });
  });

  describe('cancel', () => {
    test('test_cancel_allItemsUnderReview_cancelsAndRecomputesRetention', async () => {
      const { service, submissionRepo, itemRepo, attachmentService } = buildService();
      submissionRepo.findOneBy.mockResolvedValue({ id: 'submission-1', personId: 'student-1' });
      itemRepo.findBy.mockResolvedValue([{ id: 'item-1', status: 'under_review' }]);

      await service.cancel('submission-1', 'student-1');

      expect(itemRepo.update).toHaveBeenCalledWith(
        { submissionId: 'submission-1', status: 'under_review' },
        expect.objectContaining({ status: 'cancelled_by_student' }),
      );
      expect(attachmentService.recomputeRetentionSchedule).toHaveBeenCalledWith('submission-1');
    });

    // RULE-JUST-05.4: cancelling is only possible while nobody has decided.
    test('test_cancel_someItemAlreadyDecided_throwsBadRequest', async () => {
      const { service, submissionRepo, itemRepo } = buildService();
      submissionRepo.findOneBy.mockResolvedValue({ id: 'submission-1', personId: 'student-1' });
      itemRepo.findBy.mockResolvedValue([
        { id: 'item-1', status: 'under_review' },
        { id: 'item-2', status: 'approved' },
      ]);

      await expect(service.cancel('submission-1', 'student-1')).rejects.toThrow(BadRequestException);
    });

    test('test_cancel_submissionDoesNotExist_throwsNotFound', async () => {
      const { service, submissionRepo } = buildService();
      submissionRepo.findOneBy.mockResolvedValue(null);

      await expect(service.cancel('submission-does-not-exist', 'student-1')).rejects.toThrow(NotFoundException);
    });

    // Kept as an explicit guard even though RLS's student_ownership already
    // scopes findOneBy to the caller's own rows in production — see the
    // service's own comment on this branch. Still worth locking in at the
    // unit level: if this application-level check were ever silently dropped
    // (e.g. during a refactor), student_ownership RLS is the only remaining
    // line of defense, and this test would catch the regression immediately
    // instead of relying solely on an integration/RLS-level test to notice.
    test('test_cancel_submissionBelongsToSomeoneElse_throwsForbidden', async () => {
      const { service, submissionRepo, itemRepo } = buildService();
      submissionRepo.findOneBy.mockResolvedValue({ id: 'submission-1', personId: 'other-student' });

      await expect(service.cancel('submission-1', 'student-1')).rejects.toThrow(ForbiddenException);
      expect(itemRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('listMine', () => {
    test('test_listMine_returnsCallersOwnSubmissionsOrderedByCreatedAtDesc', async () => {
      const { service, submissionRepo } = buildService();
      const submissions = [{ id: 'submission-2' }, { id: 'submission-1' }];
      submissionRepo.find.mockResolvedValue(submissions);

      const result = await service.listMine('student-1');

      expect(result).toBe(submissions);
      expect(submissionRepo.find).toHaveBeenCalledWith({ where: { personId: 'student-1' }, order: { createdAt: 'DESC' } });
    });
  });

  describe('listItemsForSubmission', () => {
    test('test_listItemsForSubmission_ownSubmission_returnsItems', async () => {
      const { service, submissionRepo, itemRepo } = buildService();
      submissionRepo.findOneBy.mockResolvedValue({ id: 'submission-1', personId: 'student-1' });
      const items = [{ id: 'item-1' }];
      itemRepo.findBy.mockResolvedValue(items);

      const result = await service.listItemsForSubmission('submission-1', 'student-1');

      expect(result).toBe(items);
      expect(itemRepo.findBy).toHaveBeenCalledWith({ submissionId: 'submission-1' });
    });

    test('test_listItemsForSubmission_submissionDoesNotExist_throwsNotFound', async () => {
      const { service, submissionRepo } = buildService();
      submissionRepo.findOneBy.mockResolvedValue(null);

      await expect(service.listItemsForSubmission('submission-does-not-exist', 'student-1')).rejects.toThrow(NotFoundException);
    });

    // RULE-JUST-08/24's counterpart on the student side: even though a
    // professor might be authorized to decide these items via
    // teacher_subject_scope, this method is the STUDENT'S own "my request"
    // view and 404s for anyone but the titular — AbsenceJustificationDecisionService
    // .listQueueForTeacher() is the professor's own, separate read path.
    test('test_listItemsForSubmission_submissionBelongsToSomeoneElse_throwsNotFound', async () => {
      const { service, submissionRepo, itemRepo } = buildService();
      submissionRepo.findOneBy.mockResolvedValue({ id: 'submission-1', personId: 'other-student' });

      await expect(service.listItemsForSubmission('submission-1', 'student-1')).rejects.toThrow(NotFoundException);
      expect(itemRepo.findBy).not.toHaveBeenCalled();
    });
  });
});
