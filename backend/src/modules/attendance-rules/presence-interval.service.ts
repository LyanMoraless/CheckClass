import { Injectable, Logger } from '@nestjs/common';
import { IdentificationCheckinEntity, PresenceIntervalEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface PresenceIntervalResult {
  closedIntervals: Array<{ entryAt: Date; exitAt: Date }>;
  hasOpenInterval: boolean;
}

interface CheckinRow {
  checkin_at: Date;
  factor_code: string;
}

// Pairs ROOM_ENTRY/ROOM_EXIT checkins into presence_interval rows.
// RULE-ATT-08: total permanência is the SUM of every entry→exit interval in
// the session, not just first-entry-to-last-exit. RULE-ATT-09: an entry with
// no matching exit stays open (exit_at NULL) — never assumed to run through
// to session end. Recomputed from scratch each call (delete + reinsert),
// since it's always deriving from source checkins, not accumulating state.
@Injectable()
export class PresenceIntervalService {
  private readonly logger = new Logger(PresenceIntervalService.name);

  constructor(private readonly tenantContext: TenantContextService) {}

  async rebuildForPerson(classSessionId: string, personId: string): Promise<PresenceIntervalResult> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const rows: CheckinRow[] = await manager.query(
      `
      SELECT ic.checkin_at, aft.code AS factor_code
      FROM identification_checkin ic
      JOIN attendance_factor_type aft ON aft.id = ic.attendance_factor_type_id
      WHERE ic.tenant_id = $1
        AND ic.class_session_id = $2
        AND ic.person_id = $3
        AND ic.is_duplicate = false
        AND aft.code IN ('ROOM_ENTRY', 'ROOM_EXIT')
      ORDER BY ic.checkin_at ASC
      `,
      [tenantId, classSessionId, personId],
    );

    const closedIntervals: Array<{ entryAt: Date; exitAt: Date }> = [];
    let openEntryAt: Date | null = null;

    for (const row of rows) {
      if (row.factor_code === 'ROOM_ENTRY') {
        if (openEntryAt) {
          this.logger.warn(
            `Two ROOM_ENTRY in a row for person ${personId} in session ${classSessionId} — treating the later one as the active entry`,
          );
        }
        openEntryAt = row.checkin_at;
      } else {
        // ROOM_EXIT
        if (openEntryAt) {
          closedIntervals.push({ entryAt: openEntryAt, exitAt: row.checkin_at });
          openEntryAt = null;
        } else {
          this.logger.warn(
            `ROOM_EXIT with no preceding ROOM_ENTRY for person ${personId} in session ${classSessionId} — ignored, can't pair`,
          );
        }
      }
    }

    const hasOpenInterval = openEntryAt !== null;

    const repository = manager.getRepository(PresenceIntervalEntity);
    await repository.delete({ classSessionId, personId });

    const toInsert = closedIntervals.map((interval) =>
      repository.create({ tenantId, classSessionId, personId, entryAt: interval.entryAt, exitAt: interval.exitAt }),
    );
    if (hasOpenInterval && openEntryAt) {
      toInsert.push(repository.create({ tenantId, classSessionId, personId, entryAt: openEntryAt, exitAt: null }));
    }
    if (toInsert.length > 0) {
      await repository.save(toInsert);
    }

    return { closedIntervals, hasOpenInterval };
  }
}
