import { randomUUID } from 'crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { fromBuffer as fileTypeFromBuffer } from 'file-type';
import { addUtcDays } from '../../common/utc-date.util';
import {
  AbsenceJustificationAttachmentAccessLogEntity,
  AbsenceJustificationAttachmentEntity,
  AbsenceJustificationItemEntity,
} from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { PermissionGroupService } from '../auth/permission-group.service';
import { Permission } from '../auth/permission.enum';
import { AbsenceJustificationAttachmentStorageService } from './absence-justification-attachment-storage.service';
import {
  ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES,
  ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES,
  ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS,
} from './absence-justification.constants';
import { AbsenceJustificationRlsContextService } from './absence-justification-rls-context.service';
import { TeacherSubjectScopeService } from './teacher-subject-scope.service';

// RULE-JUST-18/19: the states that stop an item's clock — cancelled_by_student
// and closed_subject_removed included, even though this round implements no
// call site that ever sets closed_subject_removed (see the Backend
// Implementation Summary — the "remover matéria da turma" admin flow does
// not exist yet).
const TERMINAL_ITEM_STATUSES = ['approved', 'rejected', 'cancelled_by_student', 'closed_subject_removed', 'approval_revoked'];

export interface DownloadRequestContext {
  requesterPersonId: string;
  ipAddress: string;
  userAgent: string | null;
}

export interface DownloadedAttachment {
  body: Buffer;
  mimeType: string;
  originalFilename: string;
}

// Owns the full lifecycle of the ONE attachment a submission may have
// (RULE-JUST-09/11/19): acceptance validation, upload, gated download with
// mandatory access logging, and the 30-day retention clock.
@Injectable()
export class AbsenceJustificationAttachmentService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly storage: AbsenceJustificationAttachmentStorageService,
    private readonly teacherScope: TeacherSubjectScopeService,
    private readonly permissionGroupService: PermissionGroupService,
    private readonly rlsContext: AbsenceJustificationRlsContextService,
  ) {}

  // RULE-JUST-11 format/size decision, checked BEFORE the eligibility
  // derivation even runs (AbsenceJustificationSubmissionService.create) —
  // failing fast on an unacceptable file costs nothing extra and avoids a
  // wasted eligibility query for a request that cannot succeed anyway.
  //
  // Async since the magic-bytes check below (Security Agent, OWASP
  // unrestricted-file-upload finding) reads the buffer's real content —
  // file.mimetype up to that point is only the CLIENT-DECLARED
  // Content-Type, which is trivially spoofable (e.g. a renamed .html
  // uploaded as "application/pdf").
  async assertUploadIsAcceptable(file: Express.Multer.File): Promise<void> {
    const allowed: readonly string[] = ABSENCE_JUSTIFICATION_ATTACHMENT_ALLOWED_MIME_TYPES;
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported attachment type "${file.mimetype}" — only PDF, JPEG and PNG are accepted (RULE-JUST-11)`,
      );
    }
    if (file.size > ABSENCE_JUSTIFICATION_ATTACHMENT_MAX_SIZE_BYTES) {
      throw new BadRequestException('Attachment exceeds the 10 MB limit (RULE-JUST-11)');
    }

    // Detects the REAL type from the file's magic bytes and requires it to
    // both (a) be in the same allow-list as the declared Content-Type and
    // (b) match that declared Content-Type exactly — a mismatch (or no
    // detectable type at all, e.g. plain text/HTML/script content) is
    // rejected outright, never persisted. This is on top of, never instead
    // of, the declared-type check above (RULE-JUST-11's allow-list is still
    // the first gate).
    //
    // file-type's own tokenizer throws (rather than resolving undefined) on
    // a buffer too short/truncated to contain the format's full header (e.g.
    // a malformed or deliberately corrupted PNG) — a rejected upload either
    // way, so it is folded into the same "content could not be verified"
    // outcome instead of surfacing as an unhandled 500.
    const detected = await fileTypeFromBuffer(file.buffer).catch(() => undefined);
    if (!detected || detected.mime !== file.mimetype || !allowed.includes(detected.mime)) {
      throw new BadRequestException(
        `Attachment content does not match its declared type "${file.mimetype}" (RULE-JUST-11)`,
      );
    }
  }

  // Called ONLY after at least one eligible item already exists for the
  // submission (RULE-JUST-14: "se nenhuma sessão for elegível... o anexo não
  // é armazenado") — AbsenceJustificationSubmissionService is the single
  // caller and enforces that ordering.
  async uploadForSubmission(
    submissionId: string,
    personId: string,
    file: Express.Multer.File,
  ): Promise<AbsenceJustificationAttachmentEntity> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const storageKey = `${tenantId}/absence-justifications/${submissionId}/${randomUUID()}`;
    await this.storage.upload(storageKey, file.buffer, file.mimetype);

    const repository = manager.getRepository(AbsenceJustificationAttachmentEntity);
    return repository.save(
      repository.create({
        tenantId,
        submissionId,
        personId,
        storageKey,
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }),
    );
  }

  // RULE-JUST-08/11/19/24: the single gate every open of the attachment's
  // bytes goes through, for both roles (titular and subject-teacher) — logs
  // EVERY attempt, granted or not, per RULE-JUST-11.2 ("Exceptions:
  // Nenhuma").
  async download(submissionId: string, context: DownloadRequestContext): Promise<DownloadedAttachment> {
    const manager = this.tenantContext.getManager();
    let attachment = await manager.getRepository(AbsenceJustificationAttachmentEntity).findOneBy({ submissionId });

    if (!attachment) {
      // student_ownership/teacher_subject_scope already return zero rows for
      // a requester with NO relation whatsoever to the submission — the far
      // more common unauthorized shape than the missing_permission/
      // not_subject_teacher cases authorize() below can ever see, and one
      // that would otherwise leave RULE-JUST-11.2's "inclusive tentativas
      // negadas" completely unlogged (Security Agent finding, post-review of
      // AddAbsenceJustification). findAttachmentForAccessLogOnly briefly
      // lifts a narrow, SELECT-only door (access_log_lookup_scope) to tell a
      // truly nonexistent submission apart from one that exists but is
      // simply invisible to this requester — never returning the row itself
      // to the caller, only feeding it to logAccess below.
      attachment = await this.findAttachmentForAccessLogOnly(submissionId);
      if (!attachment) {
        // Genuinely no attachment for this submission — nothing exists to
        // log an attempt against (the access log's FK requires a real
        // attachment id/owner), so there is nothing more to record.
        throw new NotFoundException(`No attachment found for submission ${submissionId}`);
      }
      await this.logAccess(attachment, context, 'denied', 'no_relation_to_submission');
      throw new ForbiddenException('You are not authorized to open this attachment (RULE-JUST-08/24)');
    }

    const { granted, denialReason } = await this.authorize(attachment, context.requesterPersonId);
    if (!granted) {
      // Logged as 'denied' regardless of whether the file has since been
      // eliminated — an unauthorized requester must never learn the
      // difference (RULE-JUST-19.5's explicit "arquivo eliminado" message is
      // for an AUTHORIZED requester only).
      await this.logAccess(attachment, context, 'denied', denialReason);
      throw new ForbiddenException('You are not authorized to open this attachment (RULE-JUST-08/24)');
    }

    if (!attachment.storageKey) {
      // RULE-JUST-19.5: never a generic error for an already-eliminated file.
      await this.logAccess(attachment, context, 'deleted_unavailable', null);
      throw new NotFoundException('This attachment was eliminated according to the retention policy (RULE-JUST-09/19)');
    }

    const body = await this.storage.download(attachment.storageKey);
    await this.logAccess(attachment, context, 'granted', null);

    return { body, mimeType: attachment.mimeType, originalFilename: attachment.originalFilename };
  }

  // RULE-JUST-19: recomputes/advances the attachment's deletion clock every
  // time an item of its submission reaches a terminal state. Called by the
  // submission/decision services right after they change an item's status —
  // never a scheduler; this project deliberately has none (see
  // frequency-warning-read.service.ts's header for the established
  // precedent of driving "no scheduler" reconciliation off the request that
  // needs it, applied here to the WRITE side instead of a read).
  async recomputeRetentionSchedule(submissionId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const items = await manager.getRepository(AbsenceJustificationItemEntity).findBy({ submissionId });
    if (items.length === 0 || items.some((item) => !TERMINAL_ITEM_STATUSES.includes(item.status))) {
      return; // at least one item is still under_review — clock not started.
    }

    const attachment = await manager.getRepository(AbsenceJustificationAttachmentEntity).findOneBy({ submissionId });
    if (!attachment || attachment.deletedAt) {
      return;
    }

    // RULE-JUST-19.3: every item cancelled by the student before ANY human
    // decision — eliminate immediately, nobody ever needed the file.
    if (items.every((item) => item.status === 'cancelled_by_student')) {
      await this.eliminate(attachment);
      return;
    }

    const lastTerminalAt = items.reduce<Date>((latest, item) => {
      const terminalAt = item.terminalAt ?? item.updatedAt;
      return terminalAt.getTime() > latest.getTime() ? terminalAt : latest;
    }, new Date(0));

    await manager
      .getRepository(AbsenceJustificationAttachmentEntity)
      .update({ id: attachment.id }, { scheduledDeletionAt: addUtcDays(lastTerminalAt, ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS) });
  }

  // RULE-JUST-11.4: "o aluno titular sempre pode ver o próprio anexo e
  // saber quem o abriu" — a direct read of the access log's rows for the
  // titular's own attachment, chronological (newest first). The attachment
  // lookup below is scoped by student_ownership RLS the same way every
  // other read in this module is; the explicit personId check on top is the
  // same redundant-guard posture AbsenceJustificationSubmissionService.cancel()
  // already documents for its own ownership check — never load-bearing on
  // its own, always alongside the RLS policy actually enforcing it
  // (student_ownership on the attachment, student_ownership_read on the log
  // itself). A teacher CAN see the attachment row via teacher_subject_scope,
  // but is never the titular, so they hit the ForbiddenException below —
  // RULE-JUST-11.4/the confirmed "quem consulta o log" decision restrict
  // this read to the titular only, explicitly excluding professor/
  // coordenação/direção.
  async listAccessLogForSubmission(
    submissionId: string,
    personId: string,
  ): Promise<AbsenceJustificationAttachmentAccessLogEntity[]> {
    const manager = this.tenantContext.getManager();
    const attachment = await manager.getRepository(AbsenceJustificationAttachmentEntity).findOneBy({ submissionId });
    if (!attachment) {
      throw new NotFoundException(`No attachment found for submission ${submissionId}`);
    }
    if (attachment.personId !== personId) {
      throw new ForbiddenException('Only the titular of this attachment may consult its access log (RULE-JUST-11.4)');
    }

    return manager
      .getRepository(AbsenceJustificationAttachmentAccessLogEntity)
      .find({ where: { attachmentId: attachment.id }, order: { occurredAt: 'DESC' } });
  }

  // Only the unattended retention sweep script calls this — see
  // src/scripts/absence-justification-attachment-retention-sweep.ts. Scoped
  // to the current tenant via the same app.tenant_id the whole request
  // already carries; the retention_job_scope RLS policy (not
  // student_ownership/teacher_subject_scope) is what makes every row of this
  // tenant visible to it.
  async sweepDueAttachments(): Promise<number> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const due = await manager
      .getRepository(AbsenceJustificationAttachmentEntity)
      .createQueryBuilder('a')
      .where('a.tenantId = :tenantId', { tenantId })
      .andWhere('a.deletedAt IS NULL')
      .andWhere('a.scheduledDeletionAt IS NOT NULL')
      .andWhere('a.scheduledDeletionAt <= :now', { now: new Date() })
      .getMany();

    for (const attachment of due) {
      // eslint-disable-next-line no-await-in-loop -- sequential, low volume,
      // one tenant's sweep at a time (CLI invocation, RULE-JUST-19).
      await this.eliminate(attachment);
    }
    return due.length;
  }

  private async eliminate(attachment: AbsenceJustificationAttachmentEntity): Promise<void> {
    if (attachment.storageKey) {
      await this.storage.delete(attachment.storageKey);
    }
    // RULE-JUST-11.9/19.4: mutates THIS row only — never a DELETE, and
    // nothing here cascades into item/item_decision/submission/notice.
    await this.tenantContext
      .getManager()
      .getRepository(AbsenceJustificationAttachmentEntity)
      .update({ id: attachment.id }, { storageKey: null, deletedAt: new Date() });
  }

  // See AddAbsenceJustificationAccessLogLookupScope's migration header — a
  // narrow, SELECT-only, GUC-gated existence check used EXCLUSIVELY to feed
  // logAccess() below when the requester has no relation to the submission
  // at all (student_ownership/teacher_subject_scope already hide the row
  // completely in that case). The scope is turned back off immediately
  // after this one query, in a `finally`, so it never lingers for the rest
  // of the request/transaction — defense in depth on top of it already
  // being SET LOCAL (transaction-scoped).
  private async findAttachmentForAccessLogOnly(submissionId: string): Promise<AbsenceJustificationAttachmentEntity | null> {
    const manager = this.tenantContext.getManager();
    await this.rlsContext.applyAccessLogLookupScope();
    try {
      return await manager.getRepository(AbsenceJustificationAttachmentEntity).findOneBy({ submissionId });
    } finally {
      await this.rlsContext.clearAccessLogLookupScope();
    }
  }

  private async authorize(
    attachment: AbsenceJustificationAttachmentEntity,
    requesterPersonId: string,
  ): Promise<{ granted: boolean; denialReason: string | null }> {
    if (attachment.personId === requesterPersonId) {
      // RULE-JUST-11.4: the titular always sees their own attachment.
      return { granted: true, denialReason: null };
    }

    const hasPermission = await this.permissionGroupService.hasPermission(
      requesterPersonId,
      Permission.VIEW_ABSENCE_JUSTIFICATION_ATTACHMENT,
    );
    if (!hasPermission) {
      return { granted: false, denialReason: 'missing_permission' };
    }

    // RULE-JUST-24: narrow (turma, matéria) check — ANY item of this
    // submission the requester teaches is enough (same predicate as the
    // attachment's own teacher_subject_scope RLS policy in the
    // AddAbsenceJustification migration).
    const manager = this.tenantContext.getManager();
    const items = await manager.getRepository(AbsenceJustificationItemEntity).findBy({ submissionId: attachment.submissionId });
    for (const item of items) {
      // eslint-disable-next-line no-await-in-loop -- short-circuit on first match.
      if (await this.teacherScope.isSubjectTeacher(requesterPersonId, item.classGroupId, item.subjectId)) {
        return { granted: true, denialReason: null };
      }
    }
    return { granted: false, denialReason: 'not_subject_teacher' };
  }

  private async logAccess(
    attachment: AbsenceJustificationAttachmentEntity,
    context: DownloadRequestContext,
    result: 'granted' | 'denied' | 'deleted_unavailable',
    denialReason: string | null,
  ): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(AbsenceJustificationAttachmentAccessLogEntity);
    await repository.save(
      repository.create({
        tenantId: attachment.tenantId,
        attachmentId: attachment.id,
        attachmentOwnerPersonId: attachment.personId,
        accessedByPersonId: context.requesterPersonId,
        accessResult: result,
        denialReason,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      }),
    );
  }
}
