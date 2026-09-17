import { Injectable } from '@nestjs/common';
import { PresenceIntervalEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';
import { RoomPresenceService } from '../room-presence/room-presence.service';

export interface PresenceIntervalResult {
  closedIntervals: Array<{ entryAt: Date; exitAt: Date }>;
  hasOpenInterval: boolean;
}

// Pairs ROOM_ENTRY/ROOM_EXIT checkins into presence_interval rows.
// RULE-ATT-08: total permanência is the SUM of every entry→exit interval in
// the session, not just first-entry-to-last-exit. RULE-ATT-09: an entry with
// no matching exit stays open (exit_at NULL) — never assumed to run through
// to session end. Recomputed from scratch each call (delete + reinsert),
// since it's always deriving from source data, not accumulating state.
//
// "Decisão de arquitetura — Fluxo de Chamada Redesenhado" (architecture-
// overview.md): the pairing logic itself now lives in
// RoomPresenceService.getSessionProjectedInterval (RULE-PRES-04/05/06/07/08)
// — this service no longer queries identification_checkin directly for
// ROOM_ENTRY/ROOM_EXIT, it consumes that projection and persists it,
// unchanged in shape (same closedIntervals/hasOpenInterval output contract
// every caller, AttendanceRulesEngineService included, already relies on).
// No other factor is touched by this change — this service's entire job was
// already only ever ROOM_ENTRY/ROOM_EXIT pairing.
@Injectable()
export class PresenceIntervalService {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly roomPresenceService: RoomPresenceService,
  ) {}

  async rebuildForPerson(classSessionId: string, personId: string): Promise<PresenceIntervalResult> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const { closedIntervals, hasOpenInterval, openIntervalEntryAt } = await this.roomPresenceService.getSessionProjectedInterval(
      personId,
      classSessionId,
    );

    const repository = manager.getRepository(PresenceIntervalEntity);
    await repository.delete({ classSessionId, personId });

    const toInsert = closedIntervals.map((interval) =>
      repository.create({ tenantId, classSessionId, personId, entryAt: interval.entryAt, exitAt: interval.exitAt }),
    );
    if (hasOpenInterval && openIntervalEntryAt) {
      toInsert.push(repository.create({ tenantId, classSessionId, personId, entryAt: openIntervalEntryAt, exitAt: null }));
    }
    if (toInsert.length > 0) {
      await repository.save(toInsert);
    }

    return { closedIntervals, hasOpenInterval };
  }
}
