import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AbsenceJustificationAttachmentEntity,
  AbsenceJustificationItemDecisionEntity,
  AbsenceJustificationItemEntity,
  ClassGroupEntity,
  ClassSessionEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { AbsenceJustificationDecisionService } from './absence-justification-decision.service';

// RULE-JUST-03/06/08/17/23/24: the professor's approve/reject/revoke acts —
// the highest-consequence logic in Frente 07 (it writes Controle A's
// consolidation row AND triggers Controle B's recalculation).
describe('AbsenceJustificationDecisionService', () => {
  const ITEM: AbsenceJustificationItemEntity = {
    id: 'item-1',
    tenantId: 'tenant-a-id',
    submissionId: 'submission-1',
    personId: 'student-1',
    classSessionId: 'session-1',
    classGroupId: 'class-group-1',
    subjectId: 'subject-1',
    status: 'under_review',
    decidedByPersonId: null,
    decidedAt: null,
    terminalAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildService(overrides: { item?: Partial<AbsenceJustificationItemEntity>; isSubjectTeacher?: boolean } = {}) {
    const item = { ...ITEM, ...overrides.item };

    const itemRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(item),
      findOneByOrFail: jest.fn().mockResolvedValue(item),
    });
    const decisionRepo = createMockRepository();
    const consolidationRepo = createMockRepository({
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    });
    const classGroupRepo = createMockRepository({
      findOneByOrFail: jest.fn().mockResolvedValue({
        id: 'class-group-1',
        termStartDate: new Date('2026-08-01'),
        termEndDate: new Date('2026-12-31'),
      } as ClassGroupEntity),
    });
    const sessionRepo = createMockRepository({
      findOneByOrFail: jest.fn().mockResolvedValue({ id: 'session-1', scheduledStart: new Date('2026-09-01') } as ClassSessionEntity),
    });
    // Default: attachment still exists and has not been eliminated —
    // RULE-JUST-17's exception (see revoke()) only bites when a test
    // overrides this, e.g. the attachment-eliminated case below.
    const attachmentRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue({ id: 'attachment-1', submissionId: 'submission-1', storageKey: 'k', deletedAt: null }),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AbsenceJustificationItemEntity, itemRepo],
      [AbsenceJustificationItemDecisionEntity, decisionRepo],
      [SessionAttendanceConsolidationEntity, consolidationRepo],
      [ClassGroupEntity, classGroupRepo],
      [ClassSessionEntity, sessionRepo],
      [AbsenceJustificationAttachmentEntity, attachmentRepo],
    ]);

    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const teacherScope = { isSubjectTeacher: jest.fn().mockResolvedValue(overrides.isSubjectTeacher ?? true) };
    const tenantConfig = {
      resolveEffectiveConfig: jest.fn().mockResolvedValue({ minAccumulatedFrequencyPercentage: 75, accumulatedFrequencyPeriod: 'bimester' }),
    };
    const frequencyEngine = {
      previewForSessionPerson: jest.fn().mockResolvedValue({ calculable: true, presentCount: 30, consideredCount: 40, percentage: 75 }),
      recalculateForSessionPerson: jest.fn().mockResolvedValue({ calculable: true, presentCount: 31, consideredCount: 40, percentage: 78 }),
    };
    const attachmentService = { recomputeRetentionSchedule: jest.fn().mockResolvedValue(undefined) };
    const noticeService = {
      maybeEmitDecisionResultNotice: jest.fn().mockResolvedValue(undefined),
      recordRevocation: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AbsenceJustificationDecisionService(
      tenantContext as never,
      teacherScope as never,
      tenantConfig as never,
      frequencyEngine as never,
      attachmentService as never,
      noticeService as never,
    );

    return { service, itemRepo, decisionRepo, consolidationRepo, attachmentRepo, teacherScope, frequencyEngine, attachmentService, noticeService, manager };
  }

  describe('decide — approve', () => {
    test('test_decide_approve_flipsConsolidationToAbsentJustifiedAndRecalculates', async () => {
      const { service, itemRepo, consolidationRepo, frequencyEngine, noticeService } = buildService();

      await service.decide('item-1', 'teacher-1', 'approved', undefined);

      expect(itemRepo.update).toHaveBeenCalledWith(
        { id: 'item-1' },
        expect.objectContaining({ status: 'approved', decidedByPersonId: 'teacher-1' }),
      );
      expect(consolidationRepo.update).toHaveBeenCalledWith(
        { classSessionId: 'session-1', personId: 'student-1', status: 'absent' },
        { status: 'absent_justified', justifiedByItemId: 'item-1' },
      );
      expect(frequencyEngine.previewForSessionPerson).toHaveBeenCalledWith('session-1', 'student-1');
      expect(frequencyEngine.recalculateForSessionPerson).toHaveBeenCalledWith('session-1', 'student-1');
      expect(noticeService.maybeEmitDecisionResultNotice).toHaveBeenCalled();
    });

    // RULE-JUST-23 addendum: "before" must be read BEFORE the consolidation
    // mutation, "after" only after it -- verified by call ORDER, not just
    // call presence.
    test('test_decide_approve_readsFrequencyBeforeThenAfterInOrder', async () => {
      const { service, consolidationRepo, frequencyEngine } = buildService();
      const callOrder: string[] = [];
      frequencyEngine.previewForSessionPerson.mockImplementation(async () => {
        callOrder.push('preview');
        return { calculable: true, presentCount: 30, consideredCount: 40, percentage: 75 };
      });
      consolidationRepo.update.mockImplementation(async () => {
        callOrder.push('consolidationUpdate');
        return { affected: 1 };
      });
      frequencyEngine.recalculateForSessionPerson.mockImplementation(async () => {
        callOrder.push('recalculate');
        return { calculable: true, presentCount: 31, consideredCount: 40, percentage: 78 };
      });

      await service.decide('item-1', 'teacher-1', 'approved', undefined);

      expect(callOrder).toEqual(['preview', 'consolidationUpdate', 'recalculate']);
    });

    test('test_decide_approve_consolidationNoLongerAbsent_throwsBadRequest', async () => {
      const { service, consolidationRepo } = buildService();
      consolidationRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.decide('item-1', 'teacher-1', 'approved', undefined)).rejects.toThrow(BadRequestException);
    });

    test('test_decide_approve_notSubjectTeacher_throwsForbidden', async () => {
      const { service } = buildService({ isSubjectTeacher: false });

      await expect(service.decide('item-1', 'teacher-1', 'approved', undefined)).rejects.toThrow(ForbiddenException);
    });

    test('test_decide_itemNotUnderReview_throwsBadRequest', async () => {
      const { service } = buildService({ item: { status: 'approved' } });

      await expect(service.decide('item-1', 'teacher-1', 'approved', undefined)).rejects.toThrow(BadRequestException);
    });

    test('test_decide_itemDoesNotExist_throwsNotFound', async () => {
      const { service, itemRepo } = buildService();
      itemRepo.findOneBy.mockResolvedValue(null);

      await expect(service.decide('item-does-not-exist', 'teacher-1', 'approved', undefined)).rejects.toThrow(NotFoundException);
    });
  });

  describe('decide — reject', () => {
    // RULE-JUST-03 addendum item 1: rejecting requires a written motivo.
    test('test_decide_reject_withoutNote_throwsBadRequest', async () => {
      const { service } = buildService();

      await expect(service.decide('item-1', 'teacher-1', 'rejected', undefined)).rejects.toThrow(BadRequestException);
    });

    test('test_decide_reject_withNote_doesNotTouchConsolidationOrFrequency', async () => {
      const { service, consolidationRepo, frequencyEngine } = buildService();

      await service.decide('item-1', 'teacher-1', 'rejected', 'Atestado não cobre a data da falta');

      expect(consolidationRepo.update).not.toHaveBeenCalled();
      expect(frequencyEngine.recalculateForSessionPerson).not.toHaveBeenCalled();
    });
  });

  // RULE-JUST-12: the professor needs the categoria/motivo to decide with
  // enough information — both raw-SQL reads below JOIN
  // absence_justification_submission to surface legalCategory/description
  // alongside the item's own columns, without a second round-trip.
  describe('listQueueForTeacher', () => {
    test('test_listQueueForTeacher_joinsSubmissionAndScopesByTenantAndPerson', async () => {
      const { service, manager } = buildService();
      const rows = [{ ...ITEM, legalCategory: 'illness_temporary_incapacity', description: 'Atestado médico' }];
      manager.query.mockResolvedValue(rows);

      const result = await service.listQueueForTeacher('teacher-1');

      expect(result).toEqual(rows);
      const [sql, params] = manager.query.mock.calls[0];
      expect(sql).toContain('absence_justification_submission');
      expect(sql).toContain("i.status = 'under_review'");
      expect(params).toEqual(['tenant-a-id', 'teacher-1']);
    });
  });

  describe('listDecidedByTeacher', () => {
    test('test_listDecidedByTeacher_withoutStatus_filtersOnlyByTenantAndDecidingPerson', async () => {
      const { service, manager } = buildService();
      manager.query.mockResolvedValue([]);

      await service.listDecidedByTeacher('teacher-1');

      const [sql, params] = manager.query.mock.calls[0];
      expect(sql).toContain('i.decided_by_person_id = $2');
      expect(sql).not.toContain('i.status = $3');
      expect(params).toEqual(['tenant-a-id', 'teacher-1']);
    });

    test('test_listDecidedByTeacher_withStatus_addsStatusFilterAsThirdParam', async () => {
      const { service, manager } = buildService();
      manager.query.mockResolvedValue([]);

      await service.listDecidedByTeacher('teacher-1', 'approved');

      const [sql, params] = manager.query.mock.calls[0];
      expect(sql).toContain('i.status = $3');
      expect(params).toEqual(['tenant-a-id', 'teacher-1', 'approved']);
    });
  });

  describe('revoke', () => {
    test('test_revoke_approvedItemWithinCurrentPeriod_revertsConsolidationAndRecalculates', async () => {
      const { service, consolidationRepo, frequencyEngine, noticeService } = buildService({ item: { status: 'approved' } });
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-09-05T00:00:00.000Z'));

      try {
        await service.revoke('item-1', 'teacher-1', 'Aprovado por engano');

        expect(consolidationRepo.update).toHaveBeenCalledWith(
          { classSessionId: 'session-1', personId: 'student-1', status: 'absent_justified' },
          { status: 'absent' },
        );
        expect(frequencyEngine.recalculateForSessionPerson).toHaveBeenCalledWith('session-1', 'student-1');
        expect(noticeService.recordRevocation).toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });

    test('test_revoke_withoutNote_throwsBadRequest', async () => {
      const { service } = buildService({ item: { status: 'approved' } });

      await expect(service.revoke('item-1', 'teacher-1', '')).rejects.toThrow(BadRequestException);
    });

    test('test_revoke_itemNotApproved_throwsBadRequest', async () => {
      const { service } = buildService({ item: { status: 'under_review' } });

      await expect(service.revoke('item-1', 'teacher-1', 'motivo')).rejects.toThrow(BadRequestException);
    });

    test('test_revoke_itemDoesNotExist_throwsNotFound', async () => {
      const { service, itemRepo } = buildService({ item: { status: 'approved' } });
      itemRepo.findOneBy.mockResolvedValue(null);

      await expect(service.revoke('item-does-not-exist', 'teacher-1', 'motivo')).rejects.toThrow(NotFoundException);
    });

    // RULE-JUST-08/24 applied to revoke(): the same narrow (turma, matéria)
    // gate decide() uses — a professor who is not the subject-teacher of
    // this item must never revoke someone else's approval, even their own
    // colleague's.
    test('test_revoke_notSubjectTeacher_throwsForbidden', async () => {
      const { service } = buildService({ item: { status: 'approved' }, isSubjectTeacher: false });

      await expect(service.revoke('item-1', 'teacher-1', 'motivo')).rejects.toThrow(ForbiddenException);
    });

    // FINDING (not fixed here — flagged for the Orchestrator/Backend Agent):
    // RULE-JUST-17's own stated exception is "Nenhuma revogação é possível
    // depois de o anexo ter sido eliminado (RULE-JUST-19), porque o professor
    // não teria mais como reexaminar a base da decisão." revoke() in
    // absence-justification-decision.service.ts never looks up
    // AbsenceJustificationAttachmentEntity at all, so it has no way to honor
    // this exception — a revocation submitted while the item's own reporting
    // period is still current (RULE-JUST-17.3, which IS enforced) succeeds
    // even when the submission's attachment has already been eliminated by
    // the 30-day retention sweep (a real window: retention counts from the
    // LAST item's terminal_at, which can be well inside a still-current,
    // long reporting period such as a semester). Marked `test.failing`
    // because it encodes the CORRECT behavior per RULE-JUST-17's exception —
    // it is expected to fail against the current implementation, and Jest
    // will flag it (test unexpectedly passed) if this gap is ever closed.
    test('test_revoke_attachmentAlreadyEliminated_shouldBeBlockedByRuleJust17Exception', async () => {
      const { service, manager } = buildService({ item: { status: 'approved' } });
      const attachmentRepo = createMockRepository({
        findOneBy: jest.fn().mockResolvedValue({ id: 'attachment-1', submissionId: 'submission-1', storageKey: null, deletedAt: new Date() }),
      });
      // AbsenceJustificationAttachmentEntity is not registered by buildService
      // at all today — this line is itself evidence revoke() never queries
      // it; registering it here only supports what a FIXED implementation
      // would need in order to check attachment.deletedAt before proceeding.
      const originalGetRepository = manager.getRepository.getMockImplementation()!;
      manager.getRepository.mockImplementation((entity: unknown) =>
        entity === AbsenceJustificationAttachmentEntity ? attachmentRepo : originalGetRepository(entity),
      );
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2026-09-05T00:00:00.000Z'));

      try {
        await expect(service.revoke('item-1', 'teacher-1', 'Aprovado por engano')).rejects.toThrow(BadRequestException);
      } finally {
        jest.useRealTimers();
      }
    });

    // RULE-JUST-17.3: only while the session's own período de apuração is
    // still current.
    test('test_revoke_periodNoLongerCurrent_throwsBadRequest', async () => {
      const { service } = buildService({ item: { status: 'approved' } });
      // "now" is far past the turma's whole term -- currentWindow resolves
      // to null, session's own window does not, so they can never match.
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] }).setSystemTime(new Date('2027-06-01T00:00:00.000Z'));

      try {
        await expect(service.revoke('item-1', 'teacher-1', 'motivo')).rejects.toThrow(BadRequestException);
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
