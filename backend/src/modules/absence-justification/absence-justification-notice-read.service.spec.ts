import { NotFoundException } from '@nestjs/common';
import { AbsenceJustificationNoticeEntity } from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockSelectQueryBuilder, createMockTenantContext } from '../../../test/unit/support/mock-entity-manager';
import { AbsenceJustificationNoticeReadService } from './absence-justification-notice-read.service';

// RULE-JUST-21/22: exclusive to the student titular's own read surface —
// deliberately its own model, not merged into GET /v1/me/warnings this
// round. listMine()'s "mark unseen as seen" side effect (RULE-JUST-22.2:
// being seen never removes the notice) and dismiss()'s ownership check
// (RULE-JUST-22.5's titular-only posture) are both pure application logic
// with no existing coverage before this spec.
describe('AbsenceJustificationNoticeReadService', () => {
  const NOTICE_UNSEEN: AbsenceJustificationNoticeEntity = {
    id: 'notice-1',
    tenantId: 'tenant-a-id',
    personId: 'student-1',
    submissionId: 'submission-1',
    subjectId: 'subject-1',
    noticeType: 'decision_result',
    details: {},
    seenAt: null,
    dismissedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildService(overrides: { notices?: AbsenceJustificationNoticeEntity[] } = {}) {
    const queryBuilder = createMockSelectQueryBuilder(overrides.notices ?? [NOTICE_UNSEEN]);
    const noticeRepo = createMockRepository({ createQueryBuilder: jest.fn().mockReturnValue(queryBuilder) });

    const manager = createMockEntityManager(new Map([[AbsenceJustificationNoticeEntity, noticeRepo]]));
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const service = new AbsenceJustificationNoticeReadService(tenantContext as never);
    return { service, noticeRepo, queryBuilder, manager };
  }

  describe('listMine', () => {
    test('test_listMine_unseenNotices_marksThemSeenAndReturnsThem', async () => {
      const { service, noticeRepo } = buildService({ notices: [NOTICE_UNSEEN] });

      const result = await service.listMine('student-1');

      expect(result).toEqual([NOTICE_UNSEEN]);
      expect(noticeRepo.update).toHaveBeenCalledWith(
        { id: expect.anything() },
        expect.objectContaining({ seenAt: expect.any(Date) }),
      );
    });

    // RULE-JUST-22.2: being seen only stamps seen_at for unread-count
    // purposes — an already-seen notice must not be re-stamped/re-queried on
    // every subsequent read.
    test('test_listMine_allNoticesAlreadySeen_neverCallsUpdate', async () => {
      const seenNotice = { ...NOTICE_UNSEEN, seenAt: new Date('2026-09-01T00:00:00.000Z') };
      const { service, noticeRepo } = buildService({ notices: [seenNotice] });

      await service.listMine('student-1');

      expect(noticeRepo.update).not.toHaveBeenCalled();
    });

    test('test_listMine_noNotices_returnsEmptyArrayWithoutUpdate', async () => {
      const { service, noticeRepo } = buildService({ notices: [] });

      const result = await service.listMine('student-1');

      expect(result).toEqual([]);
      expect(noticeRepo.update).not.toHaveBeenCalled();
    });

    // Only the genuinely unseen ones are stamped — a mixed batch must not
    // blanket-update every row returned.
    test('test_listMine_mixedSeenAndUnseen_updatesOnlyUnseenIds', async () => {
      const seenNotice = { ...NOTICE_UNSEEN, id: 'notice-seen', seenAt: new Date('2026-09-01T00:00:00.000Z') };
      const unseenNotice = { ...NOTICE_UNSEEN, id: 'notice-unseen', seenAt: null };
      const { service, noticeRepo } = buildService({ notices: [seenNotice, unseenNotice] });

      await service.listMine('student-1');

      expect(noticeRepo.update).toHaveBeenCalledTimes(1);
      const [whereArg] = noticeRepo.update.mock.calls[0];
      // whereArg.id is a TypeORM In() FindOperator — its own .value getter
      // is the array of ids it was built from.
      expect((whereArg.id as { value: string[] }).value).toEqual(['notice-unseen']);
    });
  });

  describe('dismiss', () => {
    test('test_dismiss_noticeNotFound_throwsNotFound', async () => {
      const { service, noticeRepo } = buildService();
      noticeRepo.findOneBy.mockResolvedValue(null);

      await expect(service.dismiss('notice-does-not-exist', 'student-1')).rejects.toThrow(NotFoundException);
      expect(noticeRepo.update).not.toHaveBeenCalled();
    });

    // RULE-JUST-22.5: titular-only — a mismatched personId (e.g. a different
    // student, or a professor who somehow obtained the id) is treated as
    // "not found", same RULE-ATT-15/MeController idiom as
    // AbsenceJustificationSubmissionService.cancel()'s ownership check.
    test('test_dismiss_noticeBelongsToSomeoneElse_throwsNotFoundAndNeverUpdates', async () => {
      const { service, noticeRepo } = buildService();
      noticeRepo.findOneBy.mockResolvedValue({ ...NOTICE_UNSEEN, personId: 'other-student' });

      await expect(service.dismiss('notice-1', 'student-1')).rejects.toThrow(NotFoundException);
      expect(noticeRepo.update).not.toHaveBeenCalled();
    });

    test('test_dismiss_ownNotice_stampsDismissedAt', async () => {
      const { service, noticeRepo } = buildService();
      noticeRepo.findOneBy.mockResolvedValue(NOTICE_UNSEEN);

      await service.dismiss('notice-1', 'student-1');

      expect(noticeRepo.update).toHaveBeenCalledWith({ id: 'notice-1' }, { dismissedAt: expect.any(Date) });
    });
  });
});
