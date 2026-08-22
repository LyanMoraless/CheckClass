import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

export interface SessionRegisterEntry {
  personId: string;
  fullName: string;
  status: 'present' | 'absent' | 'pending';
  attendancePercentage: number;
  totalPresenceMinutes: number;
  pendingReason: string | null;
}

export interface PersonHistoryEntry {
  classSessionId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: 'present' | 'absent' | 'pending';
  attendancePercentage: number;
  pendingReason: string | null;
}

export interface ClassGroupSummaryEntry {
  personId: string;
  fullName: string;
  sessionsEvaluated: number;
  presentCount: number;
  absentCount: number;
  pendingCount: number;
  attendanceRate: number | null; // present / (present + absent); null if nothing decided yet
}

// "Serviço de Consolidação/Registro de Chamada" (architecture-overview.md):
// the official, persisted "livro de chamada" per tenant — read-only here,
// since Stage 6 (Motor de Regras) and Stage 7 (Resolução de Pendências)
// are the only writers. Domain service only: exposing this over HTTP for
// Frontend/Mobile needs real user authentication (who's allowed to see
// whose attendance), which doesn't exist yet in this backend (priority 2,
// institutional management — not built).
@Injectable()
export class AttendanceRegisterService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async getSessionRegister(classSessionId: string): Promise<SessionRegisterEntry[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        p.id AS "personId",
        p.full_name AS "fullName",
        sac.status,
        sac.attendance_percentage AS "attendancePercentage",
        sac.total_presence_minutes AS "totalPresenceMinutes",
        (
          SELECT apr.reason FROM attendance_pending_review apr
          WHERE apr.tenant_id = $1 AND apr.class_session_id = $2 AND apr.person_id = p.id
            AND apr.resolved_at IS NULL
          ORDER BY apr.created_at ASC
          LIMIT 1
        ) AS "pendingReason"
      FROM class_group_enrollment cge
      JOIN person p ON p.id = cge.person_id
      JOIN class_session cs ON cs.class_group_id = cge.class_group_id
      LEFT JOIN session_attendance_consolidation sac
        ON sac.class_session_id = cs.id AND sac.person_id = p.id
      WHERE cge.tenant_id = $1 AND cs.id = $2 AND cge.role = 'student'
      ORDER BY p.full_name ASC
      `,
      [tenantId, classSessionId],
    );
  }

  async getPersonHistory(personId: string, classGroupId?: string): Promise<PersonHistoryEntry[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        cs.id AS "classSessionId",
        cs.scheduled_start AS "scheduledStart",
        cs.scheduled_end AS "scheduledEnd",
        sac.status,
        sac.attendance_percentage AS "attendancePercentage",
        (
          SELECT apr.reason FROM attendance_pending_review apr
          WHERE apr.tenant_id = $1 AND apr.class_session_id = cs.id AND apr.person_id = $2
            AND apr.resolved_at IS NULL
          ORDER BY apr.created_at ASC
          LIMIT 1
        ) AS "pendingReason"
      FROM session_attendance_consolidation sac
      JOIN class_session cs ON cs.id = sac.class_session_id
      WHERE sac.tenant_id = $1 AND sac.person_id = $2
        AND ($3::uuid IS NULL OR cs.class_group_id = $3)
      ORDER BY cs.scheduled_start DESC
      `,
      [tenantId, personId, classGroupId ?? null],
    );
  }

  async getClassGroupSummary(classGroupId: string): Promise<ClassGroupSummaryEntry[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        p.id AS "personId",
        p.full_name AS "fullName",
        count(sac.id) AS "sessionsEvaluated",
        count(sac.id) FILTER (WHERE sac.status = 'present') AS "presentCount",
        count(sac.id) FILTER (WHERE sac.status = 'absent') AS "absentCount",
        count(sac.id) FILTER (WHERE sac.status = 'pending') AS "pendingCount"
      FROM class_group_enrollment cge
      JOIN person p ON p.id = cge.person_id
      LEFT JOIN class_session cs ON cs.class_group_id = cge.class_group_id
      LEFT JOIN session_attendance_consolidation sac
        ON sac.class_session_id = cs.id AND sac.person_id = p.id
      WHERE cge.tenant_id = $1 AND cge.class_group_id = $2 AND cge.role = 'student'
      GROUP BY p.id, p.full_name
      ORDER BY p.full_name ASC
      `,
      [tenantId, classGroupId],
    ).then((rows: Array<Record<string, string>>) =>
      rows.map((row) => {
        const presentCount = Number(row.presentCount);
        const absentCount = Number(row.absentCount);
        const decided = presentCount + absentCount;
        return {
          personId: row.personId,
          fullName: row.fullName,
          sessionsEvaluated: Number(row.sessionsEvaluated),
          presentCount,
          absentCount,
          pendingCount: Number(row.pendingCount),
          attendanceRate: decided > 0 ? (presentCount / decided) * 100 : null,
        };
      }),
    );
  }
}
