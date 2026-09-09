import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { utcMidnight } from '../../common/utc-date.util';
import { AbsenceJustificationItemEntity, AbsenceJustificationSubmissionEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { AbsenceJustificationAttachmentService } from './absence-justification-attachment.service';
import { AbsenceJustificationEligibilityService, EligibilityResult } from './absence-justification-eligibility.service';
import { CreateAbsenceJustificationSubmissionDto } from './dto/create-submission.dto';

export interface CreateSubmissionResult {
  submission: AbsenceJustificationSubmissionEntity;
  items: AbsenceJustificationItemEntity[];
  excluded: EligibilityResult['excluded'];
}

// Student-facing lifecycle of the "envio" (RULE-JUST-01 addendum/05/06/14).
@Injectable()
export class AbsenceJustificationSubmissionService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly eligibility: AbsenceJustificationEligibilityService,
    private readonly attachmentService: AbsenceJustificationAttachmentService,
  ) {}

  async create(
    personId: string,
    dto: CreateAbsenceJustificationSubmissionDto,
    file: Express.Multer.File | undefined,
  ): Promise<CreateSubmissionResult> {
    if (!file) {
      // RULE-JUST-01 addendum (2026-09-08): the attachment is ALWAYS
      // required — there is no request without a file.
      throw new BadRequestException('An attachment is required to submit an absence justification request (RULE-JUST-01)');
    }
    await this.attachmentService.assertUploadIsAcceptable(file);

    const startDate = utcMidnight(new Date(dto.startDate));
    const endDate = utcMidnight(new Date(dto.endDate));
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    const { eligible, excluded } = await this.eligibility.deriveEligibleSessions(personId, startDate, endDate);
    if (eligible.length === 0) {
      // RULE-JUST-14: zero eligible sessions refuses the WHOLE request, and
      // the attachment is NEVER stored (minimization of sensitive data,
      // RULE-JUST-04) — nothing has been persisted at this point, and this
      // throw happens before any INSERT below.
      throw new BadRequestException({
        message: 'No eligible class session was found in the given date range (RULE-JUST-14)',
        excluded,
      });
    }

    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const submissionRepository = manager.getRepository(AbsenceJustificationSubmissionEntity);
    const submission = await submissionRepository.save(
      submissionRepository.create({
        tenantId,
        personId,
        startDate,
        endDate,
        legalCategory: dto.legalCategory,
        description: dto.description,
      }),
    );

    const itemRepository = manager.getRepository(AbsenceJustificationItemEntity);
    const items = await itemRepository.save(
      eligible.map((session) =>
        itemRepository.create({
          tenantId,
          submissionId: submission.id,
          personId,
          classSessionId: session.classSessionId,
          classGroupId: session.classGroupId,
          subjectId: session.subjectId,
          status: 'under_review',
        }),
      ),
    );

    // Uploaded only now that at least one item exists to justify keeping it
    // (RULE-JUST-14). If this throws, the whole request's transaction
    // (TenantContextService.runWithTenant wraps the entire HTTP request)
    // rolls back the two inserts above along with it — no manual
    // compensation needed.
    await this.attachmentService.uploadForSubmission(submission.id, personId, file);

    return { submission, items, excluded };
  }

  async cancel(submissionId: string, personId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const submission = await manager.getRepository(AbsenceJustificationSubmissionEntity).findOneBy({ id: submissionId });
    if (!submission) {
      throw new NotFoundException(`absence_justification_submission ${submissionId} not found`);
    }
    if (submission.personId !== personId) {
      // RLS's student_ownership already scopes findOneBy above to this
      // caller's own rows — this branch is unreachable in practice and kept
      // only as an explicit guard against ever loosening that policy by
      // accident.
      throw new ForbiddenException('Not the owner of this submission');
    }

    const items = await manager.getRepository(AbsenceJustificationItemEntity).findBy({ submissionId });
    if (items.some((item) => item.status !== 'under_review')) {
      // RULE-JUST-05.4: cancelling is only possible while NOBODY has decided
      // yet — a submission with at least one already-decided item can no
      // longer be cancelled as a whole.
      throw new BadRequestException('This request can no longer be cancelled: at least one item has already been decided');
    }

    const now = new Date();
    await manager
      .getRepository(AbsenceJustificationItemEntity)
      .update({ submissionId, status: 'under_review' }, { status: 'cancelled_by_student', terminalAt: now });

    await this.attachmentService.recomputeRetentionSchedule(submissionId);
  }

  async listMine(personId: string): Promise<AbsenceJustificationSubmissionEntity[]> {
    const manager = this.tenantContext.getManager();
    return manager.getRepository(AbsenceJustificationSubmissionEntity).find({ where: { personId }, order: { createdAt: 'DESC' } });
  }

  async listItemsForSubmission(submissionId: string, personId: string): Promise<AbsenceJustificationItemEntity[]> {
    const manager = this.tenantContext.getManager();
    const submission = await manager.getRepository(AbsenceJustificationSubmissionEntity).findOneBy({ id: submissionId });
    if (!submission || submission.personId !== personId) {
      throw new NotFoundException(`absence_justification_submission ${submissionId} not found`);
    }
    return manager.getRepository(AbsenceJustificationItemEntity).findBy({ submissionId });
  }
}
