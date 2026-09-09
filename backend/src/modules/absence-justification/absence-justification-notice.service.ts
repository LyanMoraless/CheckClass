import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';
import { AbsenceJustificationItemDecisionEntity, AbsenceJustificationItemEntity, AbsenceJustificationNoticeEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { FrequencyCalculation } from '../attendance-frequency/attendance-frequency-engine.service';

// RULE-JUST-21/22: writes the two notice types from scratch — nothing shared
// with attendance_frequency_warning (RULE-JUST-22's explicit "nada
// herdado"). Read side lives in AbsenceJustificationNoticeReadService.
@Injectable()
export class AbsenceJustificationNoticeService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Called after EVERY decide() (approve/reject) — checks whether this was
  // the LAST item of (submission, subject) to leave under_review, and if so
  // emits the aggregated decision_result notice (RULE-JUST-21 item 1: "um
  // aviso por (envio, matéria)... quando TODOS os itens... atingem estado
  // terminal"). A no-op on every earlier decision of a multi-item
  // (submission, subject) pair.
  async maybeEmitDecisionResultNotice(
    item: AbsenceJustificationItemEntity,
    frequencyBefore: FrequencyCalculation | null,
    frequencyAfter: FrequencyCalculation | null,
  ): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(AbsenceJustificationNoticeEntity);

    const existing = await repository.findOneBy({
      submissionId: item.submissionId,
      subjectId: item.subjectId,
      noticeType: 'decision_result',
    });
    if (existing) {
      return; // RULE-JUST-21.1's UNIQUE means this fires at most once — idempotency guard, not expected in normal operation.
    }

    const siblings = await manager
      .getRepository(AbsenceJustificationItemEntity)
      .findBy({ submissionId: item.submissionId, subjectId: item.subjectId });
    if (siblings.some((sibling) => sibling.status === 'under_review')) {
      return; // still waiting on other items of this (envio, matéria).
    }

    const decisions = await manager
      .getRepository(AbsenceJustificationItemDecisionEntity)
      .find({ where: { itemId: In(siblings.map((sibling) => sibling.id)) }, order: { decidedAt: 'DESC' } });
    const latestNoteByItem = new Map<string, string | null>();
    for (const decision of decisions) {
      if (!latestNoteByItem.has(decision.itemId)) {
        latestNoteByItem.set(decision.itemId, decision.note);
      }
    }

    const approvedCount = siblings.filter((sibling) => sibling.status === 'approved').length;
    const rejectedCount = siblings.filter((sibling) => sibling.status === 'rejected').length;

    // details is jsonb (see the entity's header comment) — this shape is the
    // Backend Agent's own construction, not dictated verbatim by any rule;
    // it covers RULE-JUST-21 items 2-4's "conteúdo mínimo" but the exact
    // field layout is flagged for review in the Backend Implementation
    // Summary.
    const details = {
      approvedCount,
      rejectedCount,
      items: siblings.map((sibling) => ({
        classSessionId: sibling.classSessionId,
        status: sibling.status,
        note: latestNoteByItem.get(sibling.id) ?? null,
        decidedByPersonId: sibling.decidedByPersonId,
        decidedAt: sibling.decidedAt,
      })),
      // RULE-JUST-21 item 4: only present on an approval; null on a
      // rejection-only outcome.
      frequencyBeforePercentage: frequencyBefore?.calculable ? frequencyBefore.percentage : null,
      frequencyAfterPercentage: frequencyAfter?.calculable ? frequencyAfter.percentage : null,
      // RULE-JUST-21 item 3 / RULE-JUST-05.4: whether a NEW request can still
      // be opened for a rejected session — an approximate signal for the UI,
      // re-checked for real by AbsenceJustificationEligibilityService if the
      // student actually tries.
      resendMayStillBeEligible: rejectedCount > 0,
    };

    await repository.save(
      repository.create({
        tenantId: item.tenantId,
        personId: item.personId,
        submissionId: item.submissionId,
        subjectId: item.subjectId,
        noticeType: 'decision_result',
        details,
      }),
    );
  }

  // RULE-JUST-17.5: a revocation's OWN notice — never a re-emission of
  // decision_result, which already fired when the item first went terminal.
  //
  // The UNIQUE(submission_id, subject_id, notice_type) constraint allows at
  // most ONE approval_revoked row per (submission, subject) — the
  // AddAbsenceJustification migration's comment states this was sized for
  // "one decision_result and up to one approval_revoked per (submission,
  // subject)", not per-item multiplicity. If a SECOND item of the same
  // (submission, subject) is later revoked, this method APPENDS to the
  // existing notice's details instead of inserting a second row (which the
  // UNIQUE constraint would reject) — flagged in the Backend Implementation
  // Summary as a modeling edge worth a second look, not something invented
  // here to work around a bug.
  async recordRevocation(item: AbsenceJustificationItemEntity, note: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(AbsenceJustificationNoticeEntity);

    const revocationEntry = { classSessionId: item.classSessionId, note, revokedAt: new Date().toISOString() };

    const existing = await repository.findOneBy({
      submissionId: item.submissionId,
      subjectId: item.subjectId,
      noticeType: 'approval_revoked',
    });
    if (existing) {
      const previousRevocations = Array.isArray((existing.details as { revocations?: unknown[] }).revocations)
        ? ((existing.details as { revocations: unknown[] }).revocations as unknown[])
        : [];
      await repository.update(
        { id: existing.id },
        { details: { revocations: [...previousRevocations, revocationEntry] }, seenAt: null, dismissedAt: null },
      );
      return;
    }

    await repository.save(
      repository.create({
        tenantId: item.tenantId,
        personId: item.personId,
        submissionId: item.submissionId,
        subjectId: item.subjectId,
        noticeType: 'approval_revoked',
        details: { revocations: [revocationEntry] },
      }),
    );
  }
}
