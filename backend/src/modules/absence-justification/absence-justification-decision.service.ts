import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AbsenceJustificationAttachmentEntity,
  AbsenceJustificationItemDecisionEntity,
  AbsenceJustificationItemEntity,
  ClassGroupEntity,
  ClassSessionEntity,
  SessionAttendanceConsolidationEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { AttendanceFrequencyEngineService, FrequencyCalculation } from '../attendance-frequency/attendance-frequency-engine.service';
import { currentPeriodWindow, sameWindow } from '../attendance-frequency/reporting-period.util';
import { TenantConfigService } from '../config/tenant-config.service';
import { AbsenceJustificationAttachmentService } from './absence-justification-attachment.service';
import { AbsenceJustificationNoticeService } from './absence-justification-notice.service';
import { TeacherSubjectScopeService } from './teacher-subject-scope.service';

// Shape returned to the professor for both listQueueForTeacher and
// listDecidedByTeacher below: the item's own columns plus the two fields
// that only live on absence_justification_submission (RULE-JUST-12) — never
// the full submission row, just the motivo/categoria a professor needs to
// decide or to review a past decision.
export interface AbsenceJustificationItemWithSubmissionContext extends AbsenceJustificationItemEntity {
  legalCategory: string;
  description: string;
}

// Professor-facing lifecycle: the decision queue (RULE-JUST-06/08/24), the
// two acts on an item (RULE-JUST-03/06), and the append-only revocation
// (RULE-JUST-17).
@Injectable()
export class AbsenceJustificationDecisionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly teacherScope: TeacherSubjectScopeService,
    private readonly tenantConfig: TenantConfigService,
    private readonly frequencyEngine: AttendanceFrequencyEngineService,
    private readonly attachmentService: AbsenceJustificationAttachmentService,
    private readonly noticeService: AbsenceJustificationNoticeService,
  ) {}

  // RULE-JUST-06: each professor decides only the items of the (turma,
  // matéria) they teach — the JOIN below is the same predicate the
  // teacher_subject_scope RLS policy already enforces at the row level; kept
  // explicit here (rather than a bare `WHERE status = 'under_review'` relying
  // only on the invisible RLS filter) so the query reads self-evidently.
  //
  // legal_category/description are pulled straight from
  // absence_justification_submission via the JOIN below (RULE-JUST-12: the
  // professor needs the motivo/categoria to decide with enough information).
  // AbsenceJustificationSubmissionService.listItemsForSubmission is the
  // wrong tool for that — it 404s for anyone who isn't the submission's own
  // titular, which would block the professor even though the same
  // class_group_subject_teacher scope below already authorizes them. A
  // single JOIN here keeps this read on one round-trip, same as the
  // class_group_subject_teacher JOIN already does for scoping.
  async listQueueForTeacher(personId: string): Promise<AbsenceJustificationItemWithSubmissionContext[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        i.id AS "id",
        i.tenant_id AS "tenantId",
        i.submission_id AS "submissionId",
        i.person_id AS "personId",
        i.class_session_id AS "classSessionId",
        i.class_group_id AS "classGroupId",
        i.subject_id AS "subjectId",
        i.status AS "status",
        i.decided_by_person_id AS "decidedByPersonId",
        i.decided_at AS "decidedAt",
        i.terminal_at AS "terminalAt",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt",
        s.legal_category AS "legalCategory",
        s.description AS "description"
      FROM absence_justification_item i
      JOIN class_group_subject_teacher t
        ON t.tenant_id = i.tenant_id AND t.class_group_id = i.class_group_id AND t.subject_id = i.subject_id
      JOIN absence_justification_submission s
        ON s.tenant_id = i.tenant_id AND s.id = i.submission_id
      WHERE i.tenant_id = $1 AND t.person_id = $2 AND i.status = 'under_review'
      ORDER BY i.created_at ASC
      `,
      [tenantId, personId],
    );
  }

  // RULE-JUST-17: the counterpart list `queue` cannot serve — `queue` only
  // ever returns 'under_review' items, so a professor who approved an item
  // in an earlier session has no way to find it again to revoke it. This
  // lists the items THIS professor personally decided last (decided_by_
  // person_id, the item's latest-decision snapshot — see the entity's own
  // comment on why that column, not the full absence_justification_item_
  // decision trail, is the fast-read source here), optionally narrowed by
  // status (e.g. `approved`, so the UI can offer only revocable rows).
  //
  // No extra teacher_subject_scope check is needed here: decided_by_person_id
  // is only ever set, on any item, by decide()/revoke() above — both of
  // which already ran that same isSubjectTeacher gate before writing it. A
  // row can only carry this professor's id if they were authorized at the
  // moment they decided it.
  async listDecidedByTeacher(personId: string, status?: string): Promise<AbsenceJustificationItemWithSubmissionContext[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const statusFilter = status ? 'AND i.status = $3' : '';
    const parameters = status ? [tenantId, personId, status] : [tenantId, personId];

    return manager.query(
      `
      SELECT
        i.id AS "id",
        i.tenant_id AS "tenantId",
        i.submission_id AS "submissionId",
        i.person_id AS "personId",
        i.class_session_id AS "classSessionId",
        i.class_group_id AS "classGroupId",
        i.subject_id AS "subjectId",
        i.status AS "status",
        i.decided_by_person_id AS "decidedByPersonId",
        i.decided_at AS "decidedAt",
        i.terminal_at AS "terminalAt",
        i.created_at AS "createdAt",
        i.updated_at AS "updatedAt",
        s.legal_category AS "legalCategory",
        s.description AS "description"
      FROM absence_justification_item i
      JOIN absence_justification_submission s
        ON s.tenant_id = i.tenant_id AND s.id = i.submission_id
      WHERE i.tenant_id = $1 AND i.decided_by_person_id = $2 ${statusFilter}
      ORDER BY i.decided_at DESC
      `,
      parameters,
    );
  }

  async decide(
    itemId: string,
    decidingPersonId: string,
    decision: 'approved' | 'rejected',
    note: string | undefined,
  ): Promise<AbsenceJustificationItemEntity> {
    if (decision === 'rejected' && !note?.trim()) {
      // RULE-JUST-03 addendum item 1: rejecting requires a written motivo.
      throw new BadRequestException('A written note is required when rejecting an item (RULE-JUST-03)');
    }

    const manager = this.tenantContext.getManager();
    const item = await manager.getRepository(AbsenceJustificationItemEntity).findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException(`absence_justification_item ${itemId} not found`);
    }
    if (item.status !== 'under_review') {
      throw new BadRequestException(`Item ${itemId} is not under review (current status: ${item.status})`);
    }

    const authorized = await this.teacherScope.isSubjectTeacher(decidingPersonId, item.classGroupId, item.subjectId);
    if (!authorized) {
      // RULE-JUST-08/24: only the professor of THIS specific matéria, in
      // THIS turma — never the leadership chain, never a professor of a
      // different matéria in the same turma.
      throw new ForbiddenException(
        `Person ${decidingPersonId} is not the subject-teacher of (classGroup ${item.classGroupId}, subject ${item.subjectId})`,
      );
    }

    // RULE-JUST-23 addendum: the "before" percentage must be read BEFORE the
    // consolidation row is mutated below — recalculateForSessionPerson only
    // ever returns the "after" value.
    let frequencyBefore: FrequencyCalculation | null = null;
    if (decision === 'approved') {
      frequencyBefore = await this.frequencyEngine.previewForSessionPerson(item.classSessionId, item.personId);
    }

    const trimmedNote = note?.trim() || null;
    const decisionRepository = manager.getRepository(AbsenceJustificationItemDecisionEntity);
    await decisionRepository.save(
      decisionRepository.create({
        tenantId: item.tenantId,
        itemId: item.id,
        personId: item.personId,
        classGroupId: item.classGroupId,
        subjectId: item.subjectId,
        decisionType: decision,
        decidedByPersonId: decidingPersonId,
        note: trimmedNote,
      }),
    );

    const decidedAt = new Date();
    await manager
      .getRepository(AbsenceJustificationItemEntity)
      .update({ id: item.id }, { status: decision, decidedByPersonId: decidingPersonId, decidedAt, terminalAt: decidedAt });

    let frequencyAfter: FrequencyCalculation | null = null;
    if (decision === 'approved') {
      // RULE-JUST-07: the falta abonada counts as presença AND stays
      // distinguishable — 'absent_justified', never a rewrite to 'present'.
      // resolved_by_person_id/resolved_at (the pending-review resolver) are
      // left untouched by this update.
      const updateResult = await manager
        .getRepository(SessionAttendanceConsolidationEntity)
        .update(
          { classSessionId: item.classSessionId, personId: item.personId, status: 'absent' },
          { status: 'absent_justified', justifiedByItemId: item.id },
        );
      if (updateResult.affected === 0) {
        throw new BadRequestException(
          `session_attendance_consolidation for session ${item.classSessionId}/person ${item.personId} is no longer 'absent' — cannot approve`,
        );
      }

      // RULE-FREQ-06 / RULE-JUST-23: same transaction, right after the
      // consolidation update.
      frequencyAfter = await this.frequencyEngine.recalculateForSessionPerson(item.classSessionId, item.personId);
    }

    const decidedItem = await manager.getRepository(AbsenceJustificationItemEntity).findOneByOrFail({ id: item.id });
    await this.noticeService.maybeEmitDecisionResultNotice(decidedItem, frequencyBefore, frequencyAfter);
    await this.attachmentService.recomputeRetentionSchedule(item.submissionId);

    return decidedItem;
  }

  async revoke(itemId: string, revokingPersonId: string, note: string): Promise<AbsenceJustificationItemEntity> {
    if (!note?.trim()) {
      throw new BadRequestException('A written note is required to revoke an approval (RULE-JUST-17.1)');
    }

    const manager = this.tenantContext.getManager();
    const item = await manager.getRepository(AbsenceJustificationItemEntity).findOneBy({ id: itemId });
    if (!item) {
      throw new NotFoundException(`absence_justification_item ${itemId} not found`);
    }
    if (item.status !== 'approved') {
      throw new BadRequestException(`Item ${itemId} is not approved (current status: ${item.status}) — nothing to revoke`);
    }

    const authorized = await this.teacherScope.isSubjectTeacher(revokingPersonId, item.classGroupId, item.subjectId);
    if (!authorized) {
      throw new ForbiddenException(
        `Person ${revokingPersonId} is not the subject-teacher of (classGroup ${item.classGroupId}, subject ${item.subjectId})`,
      );
    }

    // RULE-JUST-17's own stated exception: "nenhuma revogação é possível
    // depois de o anexo ter sido eliminado (RULE-JUST-19)" — once the
    // attachment is gone (deletedAt set by AbsenceJustificationAttachmentService.
    // eliminate(), same signal recomputeRetentionSchedule/download already
    // treat as "eliminated") the professor has no way to reexamine the
    // documental basis of the decision, so revocation must be refused
    // outright, independent of the reporting-period check below.
    const attachment = await manager.getRepository(AbsenceJustificationAttachmentEntity).findOneBy({ submissionId: item.submissionId });
    if (!attachment || attachment.deletedAt) {
      throw new BadRequestException(
        'This approval can no longer be revoked: the attachment has already been eliminated (RULE-JUST-17/RULE-JUST-19)',
      );
    }

    // RULE-JUST-17.3: only while the session's own período de apuração is
    // still the CURRENT one — same window comparison RULE-JUST-23's engine
    // addendum uses internally, applied here at the authorization layer
    // since a revocation outside the window is refused outright, not merely
    // left un-recalculated.
    const classGroup = await manager.getRepository(ClassGroupEntity).findOneByOrFail({ id: item.classGroupId });
    const config = await this.tenantConfig.resolveEffectiveConfig(item.classGroupId);
    const session = await manager.getRepository(ClassSessionEntity).findOneByOrFail({ id: item.classSessionId });

    const sessionWindow = currentPeriodWindow(
      classGroup.termStartDate,
      classGroup.termEndDate,
      config.accumulatedFrequencyPeriod,
      session.scheduledStart,
    );
    const currentWindow = currentPeriodWindow(
      classGroup.termStartDate,
      classGroup.termEndDate,
      config.accumulatedFrequencyPeriod,
      new Date(),
    );
    if (!sessionWindow || !currentWindow || !sameWindow(sessionWindow, currentWindow)) {
      throw new BadRequestException(
        "This approval can no longer be revoked: the session's reporting period is no longer current (RULE-JUST-17.3)",
      );
    }

    const trimmedNote = note.trim();
    const decisionRepository = manager.getRepository(AbsenceJustificationItemDecisionEntity);
    await decisionRepository.save(
      decisionRepository.create({
        tenantId: item.tenantId,
        itemId: item.id,
        personId: item.personId,
        classGroupId: item.classGroupId,
        subjectId: item.subjectId,
        decisionType: 'revoked',
        decidedByPersonId: revokingPersonId,
        note: trimmedNote,
      }),
    );

    const revokedAt = new Date();
    await manager
      .getRepository(AbsenceJustificationItemEntity)
      .update(
        { id: item.id },
        { status: 'approval_revoked', decidedByPersonId: revokingPersonId, decidedAt: revokedAt, terminalAt: revokedAt },
      );

    // RULE-JUST-17.4: devolve o registro ao estado absent — NÃO anula
    // justified_by_item_id (see the entity's header comment).
    await manager
      .getRepository(SessionAttendanceConsolidationEntity)
      .update({ classSessionId: item.classSessionId, personId: item.personId, status: 'absent_justified' }, { status: 'absent' });

    // RULE-JUST-17.4: mesmo recálculo, mesma transação, logo após o update.
    await this.frequencyEngine.recalculateForSessionPerson(item.classSessionId, item.personId);

    const revokedItem = await manager.getRepository(AbsenceJustificationItemEntity).findOneByOrFail({ id: item.id });
    await this.noticeService.recordRevocation(revokedItem, trimmedNote);
    await this.attachmentService.recomputeRetentionSchedule(item.submissionId);

    return revokedItem;
  }
}
