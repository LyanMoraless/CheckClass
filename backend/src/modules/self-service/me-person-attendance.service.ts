import { Injectable } from '@nestjs/common';
import { AttendanceRegisterService, PersonHistoryEntry } from '../attendance-register/attendance-register.service';
import { AttendanceRetentionArchiveLookupService } from '../attendance-retention/attendance-retention-archive-lookup.service';

// A LIVE row from AttendanceRegisterService.getPersonHistory, or a synthetic
// row for a session that has fallen out of the live window and been folded
// into a monthly closure (RULE-RET-01's mobile-app note — see
// AttendanceRetentionArchiveLookupService's own header). `archived` is a
// discriminant on purpose, mirroring FrequencyCalculation's own
// discriminated-union shape one module over
// (attendance-frequency-engine.service.ts): a caller that forgets to check it
// should not be able to read a meaningless `status: null` as if it were a
// real attendance outcome.
export type MyAttendanceHistoryEntry =
  | (PersonHistoryEntry & { archived: false })
  | { classSessionId: string; scheduledStart: Date; scheduledEnd: Date; archived: true };

// GET /v1/me/attendance's own read model (architecture-overview.md, Frente
// 10, Estrutura proposta item 6): composes the EXISTING, unchanged
// AttendanceRegisterService.getPersonHistory (still the source for every
// session inside the live 60-day window) with
// AttendanceRetentionArchiveLookupService's gap detection, so a session that
// has left the live window reads as "archived", never as if it had never
// happened. Deliberately its OWN service, not a change to
// AttendanceRegisterService.getPersonHistory itself: that method is shared
// with the admin-facing AttendanceRegisterController (VIEW_ATTENDANCE_
// REGISTER) and the register:query CLI script, neither of which this Frente
// 10 self-service extension is scoped to touch.
@Injectable()
export class MePersonAttendanceService {
  constructor(
    private readonly registerService: AttendanceRegisterService,
    private readonly archiveLookup: AttendanceRetentionArchiveLookupService,
  ) {}

  async getMyAttendanceHistory(personId: string, classGroupId?: string): Promise<MyAttendanceHistoryEntry[]> {
    const [liveEntries, archivedGaps] = await Promise.all([
      this.registerService.getPersonHistory(personId, classGroupId),
      this.archiveLookup.findArchivedGapSessions(personId, classGroupId),
    ]);

    const merged: MyAttendanceHistoryEntry[] = [
      ...liveEntries.map((entry): MyAttendanceHistoryEntry => ({ ...entry, archived: false })),
      ...archivedGaps.map(
        (gap): MyAttendanceHistoryEntry => ({
          classSessionId: gap.classSessionId,
          scheduledStart: gap.scheduledStart,
          scheduledEnd: gap.scheduledEnd,
          archived: true,
        }),
      ),
    ];

    return merged.sort((a, b) => new Date(b.scheduledStart).getTime() - new Date(a.scheduledStart).getTime());
  }
}
