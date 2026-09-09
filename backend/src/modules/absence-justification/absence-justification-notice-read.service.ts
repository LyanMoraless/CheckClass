import { Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { addUtcDays, utcMidnight } from '../../common/utc-date.util';
import { AbsenceJustificationNoticeEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS } from './absence-justification.constants';

// RULE-JUST-22: exclusive to the student titular. Deliberately its OWN
// read model, NOT merged into GET /v1/me/warnings — RULE-JUST-22.6 confirms
// a single-list presentation is the intended UX, but names that merge a
// "read-side concern for the Backend Agent", not a mandate for this round;
// merging would touch Frente 06's already-closed self-service surface,
// which is out of THIS task's explicit scope (flagged in the Backend
// Implementation Summary).
@Injectable()
export class AbsenceJustificationNoticeReadService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async listMine(personId: string): Promise<AbsenceJustificationNoticeEntity[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    // RULE-JUST-22.3: stops being shown 30 days after issuance, or on
    // explicit dismissal — never a physical delete either way.
    const cutoff = addUtcDays(utcMidnight(new Date()), -ABSENCE_JUSTIFICATION_ATTACHMENT_RETENTION_DAYS);

    const notices = await manager
      .getRepository(AbsenceJustificationNoticeEntity)
      .createQueryBuilder('n')
      .where('n.tenantId = :tenantId', { tenantId })
      .andWhere('n.personId = :personId', { personId })
      .andWhere('n.dismissedAt IS NULL')
      .andWhere('n.createdAt >= :cutoff', { cutoff })
      .orderBy('n.createdAt', 'DESC')
      .getMany();

    // RULE-JUST-22.2: being seen only stamps seen_at for unread-count
    // purposes — it never removes the notice, unlike
    // attendance_frequency_warning's seenAt-driven first-access semantics.
    const unseenIds = notices.filter((notice) => !notice.seenAt).map((notice) => notice.id);
    if (unseenIds.length > 0) {
      await manager.getRepository(AbsenceJustificationNoticeEntity).update({ id: In(unseenIds) }, { seenAt: new Date() });
    }

    return notices;
  }

  async dismiss(noticeId: string, personId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const notice = await manager.getRepository(AbsenceJustificationNoticeEntity).findOneBy({ id: noticeId });
    if (!notice || notice.personId !== personId) {
      throw new NotFoundException(`absence_justification_notice ${noticeId} not found`);
    }
    await manager.getRepository(AbsenceJustificationNoticeEntity).update({ id: noticeId }, { dismissedAt: new Date() });
  }
}
