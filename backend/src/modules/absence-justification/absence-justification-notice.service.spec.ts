import {
  AbsenceJustificationItemDecisionEntity,
  AbsenceJustificationItemEntity,
  AbsenceJustificationNoticeEntity,
} from '../../database/entities';
import { createMockEntityManager, createMockRepository, createMockTenantContext, MockRepository } from '../../../test/unit/support/mock-entity-manager';
import { FrequencyCalculation } from '../attendance-frequency/attendance-frequency-engine.service';
import { AbsenceJustificationNoticeService } from './absence-justification-notice.service';

// RULE-JUST-21/22: the write side of the two notice types this module ever
// emits — decision_result (aggregated, once per (envio, matéria), only once
// ALL of that pair's items leave under_review) and approval_revoked
// (RULE-JUST-17.5, append-only via a jsonb array because the UNIQUE
// constraint allows at most one row per (submission, subject, notice_type)).
describe('AbsenceJustificationNoticeService', () => {
  const ITEM: AbsenceJustificationItemEntity = {
    id: 'item-1',
    tenantId: 'tenant-a-id',
    submissionId: 'submission-1',
    personId: 'student-1',
    classSessionId: 'session-1',
    classGroupId: 'class-group-1',
    subjectId: 'subject-1',
    status: 'approved',
    decidedByPersonId: 'teacher-1',
    decidedAt: new Date(),
    terminalAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function buildService(overrides: {
    existingNotice?: unknown;
    siblings?: unknown[];
    decisions?: unknown[];
  } = {}) {
    const noticeRepo = createMockRepository({
      findOneBy: jest.fn().mockResolvedValue(overrides.existingNotice ?? null),
    });
    const itemRepo = createMockRepository({
      findBy: jest.fn().mockResolvedValue(overrides.siblings ?? [ITEM]),
    });
    const decisionRepo = createMockRepository({
      find: jest.fn().mockResolvedValue(overrides.decisions ?? []),
    });

    const repositoriesByEntity = new Map<unknown, MockRepository>([
      [AbsenceJustificationNoticeEntity, noticeRepo],
      [AbsenceJustificationItemEntity, itemRepo],
      [AbsenceJustificationItemDecisionEntity, decisionRepo],
    ]);
    const manager = createMockEntityManager(repositoriesByEntity);
    const tenantContext = createMockTenantContext(manager, 'tenant-a-id');

    const service = new AbsenceJustificationNoticeService(tenantContext as never);
    return { service, noticeRepo, itemRepo, decisionRepo };
  }

  const CALCULABLE: FrequencyCalculation = { calculable: true, presentCount: 30, consideredCount: 40, percentage: 75 };
  const NOT_CALCULABLE: FrequencyCalculation = { calculable: false, reason: 'no_period_window' };

  describe('maybeEmitDecisionResultNotice', () => {
    // RULE-JUST-21.1's UNIQUE constraint means this fires at most once —
    // idempotency guard, not expected in normal operation but must not
    // double-insert if it is ever called twice for the same (submission,
    // subject).
    test('test_maybeEmit_noticeAlreadyExists_isIdempotentAndNeverQueriesSiblings', async () => {
      const { service, noticeRepo, itemRepo } = buildService({ existingNotice: { id: 'notice-1' } });

      await service.maybeEmitDecisionResultNotice(ITEM, CALCULABLE, CALCULABLE);

      expect(noticeRepo.save).not.toHaveBeenCalled();
      expect(itemRepo.findBy).not.toHaveBeenCalled();
    });

    // A multi-item (submission, subject) pair with at least one sibling still
    // under_review must not emit a notice yet — waiting for ALL of them to
    // reach a terminal state (RULE-JUST-21 item 1).
    test('test_maybeEmit_siblingStillUnderReview_doesNotEmit', async () => {
      const { service, noticeRepo } = buildService({
        siblings: [ITEM, { ...ITEM, id: 'item-2', status: 'under_review' }],
      });

      await service.maybeEmitDecisionResultNotice(ITEM, CALCULABLE, CALCULABLE);

      expect(noticeRepo.save).not.toHaveBeenCalled();
    });

    test('test_maybeEmit_allSiblingsTerminalMixedOutcome_emitsWithCountsAndResendFlagTrue', async () => {
      const siblings = [
        { ...ITEM, id: 'item-1', status: 'approved' },
        { ...ITEM, id: 'item-2', status: 'rejected' },
      ];
      const { service, noticeRepo } = buildService({ siblings });

      await service.maybeEmitDecisionResultNotice(ITEM, CALCULABLE, CALCULABLE);

      expect(noticeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: ITEM.tenantId,
          personId: ITEM.personId,
          submissionId: ITEM.submissionId,
          subjectId: ITEM.subjectId,
          noticeType: 'decision_result',
          details: expect.objectContaining({
            approvedCount: 1,
            rejectedCount: 1,
            // RULE-JUST-21 item 3 / RULE-JUST-05.4: a rejection in the mix
            // means a new request may still be eligible.
            resendMayStillBeEligible: true,
          }),
        }),
      );
    });

    // All-approved outcome: nothing was rejected, so the UI must not suggest
    // a resend is possible.
    test('test_maybeEmit_allApproved_resendFlagFalse', async () => {
      const siblings = [{ ...ITEM, status: 'approved' }];
      const { service, noticeRepo } = buildService({ siblings });

      await service.maybeEmitDecisionResultNotice(ITEM, CALCULABLE, CALCULABLE);

      const savedArg = noticeRepo.save.mock.calls[0][0];
      expect(savedArg.details.resendMayStillBeEligible).toBe(false);
    });

    // RULE-JUST-21 item 4: frequency before/after percentages only present on
    // an approval outcome — null on a rejection-only outcome (frequencyBefore/
    // After are null in that case, since decide() only ever reads them when
    // decision === 'approved').
    test('test_maybeEmit_rejectionOnly_frequencyPercentagesAreNull', async () => {
      const siblings = [{ ...ITEM, status: 'rejected' }];
      const { service, noticeRepo } = buildService({ siblings });

      await service.maybeEmitDecisionResultNotice(ITEM, null, null);

      const savedArg = noticeRepo.save.mock.calls[0][0];
      expect(savedArg.details.frequencyBeforePercentage).toBeNull();
      expect(savedArg.details.frequencyAfterPercentage).toBeNull();
    });

    // Non-calculable frequency (e.g. no_period_window) must also surface as
    // null, not as a numeric percentage that does not really exist.
    test('test_maybeEmit_frequencyNotCalculable_percentagesAreNull', async () => {
      const siblings = [{ ...ITEM, status: 'approved' }];
      const { service, noticeRepo } = buildService({ siblings });

      await service.maybeEmitDecisionResultNotice(ITEM, NOT_CALCULABLE, NOT_CALCULABLE);

      const savedArg = noticeRepo.save.mock.calls[0][0];
      expect(savedArg.details.frequencyBeforePercentage).toBeNull();
      expect(savedArg.details.frequencyAfterPercentage).toBeNull();
    });
  });

  describe('recordRevocation', () => {
    test('test_recordRevocation_noExistingNotice_createsWithSingleEntryArray', async () => {
      const { service, noticeRepo } = buildService({ existingNotice: null });

      await service.recordRevocation(ITEM, 'Aprovado por engano');

      expect(noticeRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          noticeType: 'approval_revoked',
          details: { revocations: [expect.objectContaining({ classSessionId: ITEM.classSessionId, note: 'Aprovado por engano' })] },
        }),
      );
    });

    // RULE-JUST-17.5 / the UNIQUE(submission_id, subject_id, notice_type)
    // constraint: a SECOND item of the same (submission, subject) being
    // revoked must APPEND to the existing row's details, never insert a
    // second row.
    test('test_recordRevocation_existingNotice_appendsAndResetsSeenAndDismissed', async () => {
      const existing = {
        id: 'notice-1',
        details: { revocations: [{ classSessionId: 'session-0', note: 'primeira revogação', revokedAt: '2026-09-01T00:00:00.000Z' }] },
      };
      const { service, noticeRepo } = buildService({ existingNotice: existing });

      await service.recordRevocation(ITEM, 'Segunda revogação');

      expect(noticeRepo.save).not.toHaveBeenCalled();
      expect(noticeRepo.update).toHaveBeenCalledWith(
        { id: 'notice-1' },
        expect.objectContaining({
          details: {
            revocations: [
              expect.objectContaining({ classSessionId: 'session-0', note: 'primeira revogação' }),
              expect.objectContaining({ classSessionId: ITEM.classSessionId, note: 'Segunda revogação' }),
            ],
          },
          seenAt: null,
          dismissedAt: null,
        }),
      );
    });

    // Defensive fallback: an existing row whose details.revocations is
    // missing/not an array (should never happen given this service is the
    // only writer, but the code explicitly guards for it) must not throw —
    // it starts a fresh array instead of crashing on a malformed shape.
    test('test_recordRevocation_existingNoticeWithMalformedDetails_fallsBackToEmptyArrayThenAppends', async () => {
      const existing = { id: 'notice-1', details: { revocations: 'not-an-array' } };
      const { service, noticeRepo } = buildService({ existingNotice: existing });

      await service.recordRevocation(ITEM, 'motivo');

      expect(noticeRepo.update).toHaveBeenCalledWith(
        { id: 'notice-1' },
        expect.objectContaining({
          details: { revocations: [expect.objectContaining({ note: 'motivo' })] },
        }),
      );
    });
  });
});
