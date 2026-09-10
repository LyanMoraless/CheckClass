import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';
import { ATTENDANCE_RETENTION_LIVE_WINDOW_DAYS } from './attendance-retention.constants';

export interface ArchivedGapSession {
  classSessionId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

interface GapSessionRow {
  class_session_id: string;
  scheduled_start: Date;
  scheduled_end: Date;
}

// RULE-RET-01's mobile-app note (confirmed 2026-08-22): "quando o app...
// pede um registro de presença/chamada que já saiu da janela viva de 60
// dias... o app deve exibir uma mensagem indicando que existem dados mais
// antigos, mas que foram arquivados... nunca deve simplesmente não mostrar
// nada". Estrutura proposta item 6 (architecture-overview.md, Frente 10):
// class_session itself is NOT in RULE-RET-01's purge scope (it always
// exists), so a session whose row disappeared from
// session_attendance_consolidation only reads as "archived" — never
// "nonexistent" — when BOTH: its scheduled_start is past the 60-day live
// window, AND a monthly attendance_closure_document actually covers that
// month (proof the gap is a real purge, not a session that was simply never
// evaluated for this person). Outside the window with NO matching closure
// document is the "estado inconsistente (sweep atrasado)" the architecture
// calls out — treated defensively here by NOT claiming "archived" without
// that proof, which leaves it exactly as before (silently absent) rather
// than asserting something unverified.
//
// SECURITY NOTE (flagged, not decided here): attendance_closure_document has
// NO interactive read policy today (see the AddAttendanceRetention
// migration header and AttendanceRetentionRlsContextService's own header) —
// reachable only through the unattended job's app.attendance_retention_job
// GUC, pending Frente 10 Open Question 4 ("quem pode baixar o documento de
// fechamento"). This service deliberately does NOT set that GUC from an
// ordinary self-service request — doing so would bypass the exact access
// boundary the Database Agent put in place for a decision nobody has made
// yet. It queries attendance_closure_document under the CALLER's ordinary
// tenant-scoped RLS context only, which means hasMonthlyClosureDocument
// below will always resolve to `false` today — every gap session
// conservatively falls back to the pre-existing behaviour (silently absent)
// instead of a wrongly-confident "archived" claim. This becomes correct
// automatically the moment an interactive read policy is added for this
// table — no code change needed here then.
@Injectable()
export class AttendanceRetentionArchiveLookupService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async findArchivedGapSessions(personId: string, classGroupId?: string): Promise<ArchivedGapSession[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const liveWindowCutoff = new Date(Date.now() - ATTENDANCE_RETENTION_LIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    // Driven by class_session (which always exists), LEFT JOIN'd against
    // session_attendance_consolidation, the exact same shape Controle B's
    // countInWindow/fullRescanCounts already uses for the same reason: only
    // class_session survives RULE-RET-01's purge, so only it can be the
    // source of "which sessions existed" once the consolidation row is gone.
    const gaps: GapSessionRow[] = await manager.query(
      `
      SELECT DISTINCT cs.id AS class_session_id, cs.scheduled_start, cs.scheduled_end
      FROM class_session cs
      JOIN class_group_enrollment cge
        ON cge.tenant_id = cs.tenant_id AND cge.class_group_id = cs.class_group_id AND cge.person_id = $2
      LEFT JOIN session_attendance_consolidation sac
        ON sac.tenant_id = cs.tenant_id AND sac.class_session_id = cs.id AND sac.person_id = $2
      WHERE cs.tenant_id = $1
        AND ($3::uuid IS NULL OR cs.class_group_id = $3)
        AND sac.id IS NULL
        AND cs.scheduled_start < $4
      ORDER BY cs.scheduled_start DESC
      `,
      [tenantId, personId, classGroupId ?? null, liveWindowCutoff],
    );

    if (gaps.length === 0) {
      return [];
    }

    const archived: ArchivedGapSession[] = [];
    for (const gap of gaps) {
      const scheduledStart = new Date(gap.scheduled_start);
      // eslint-disable-next-line no-await-in-loop -- self-service read, one
      // person's own gap sessions, low volume by construction.
      const hasClosureDocument = await this.hasMonthlyClosureDocument(
        tenantId,
        scheduledStart.getUTCFullYear(),
        scheduledStart.getUTCMonth() + 1,
      );
      if (hasClosureDocument) {
        archived.push({ classSessionId: gap.class_session_id, scheduledStart: gap.scheduled_start, scheduledEnd: gap.scheduled_end });
      }
    }
    return archived;
  }

  private async hasMonthlyClosureDocument(tenantId: string, year: number, month: number): Promise<boolean> {
    const manager = this.tenantContext.getManager();
    const rows: Array<{ exists: boolean }> = await manager.query(
      `
      SELECT EXISTS (
        SELECT 1 FROM attendance_closure_document
        WHERE tenant_id = $1 AND period_type = 'monthly' AND period_year = $2 AND period_month = $3
      ) AS exists
      `,
      [tenantId, year, month],
    );
    return rows[0]?.exists ?? false;
  }
}
