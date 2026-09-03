import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

export interface MyScheduleEntry {
  classSessionId: string;
  classGroupId: string;
  classGroupName: string;
  // RULE-INST-14: the matéria of THIS occurrence (class_session.subject_id),
  // not "the turma's matéria" — with several matérias per turma, the session
  // is the only level where this question has one answer.
  subjectName: string;
  roomId: string | null;
  roomName: string | null;
  scheduledStart: Date;
  scheduledEnd: Date;
  status: 'scheduled' | 'edited' | 'cancelled';
}

// RULE-ATT-15: self-scoped access to "horários/calendário" (schedule/calendar)
// — a genuinely new read, but pure composition of existing entities: the
// person's own class_group_enrollment rows joined to class_session, the same
// two tables AttendanceRegisterService already reads for the admin-facing
// register. No new business logic, no new persisted state. Deliberately its
// own tiny service (not folded into AttendanceRegisterService, which is
// consumed by the permission-gated admin routes) so the self-scoped route
// family in MeController stays a clean, separate composition root.
//
// Deliberately NOT filtered to class_group_enrollment.role = 'student' —
// kept role-agnostic on purpose (architecture-overview.md, "Decisão de
// arquitetura — Portal de Autoatendimento Web, estrutura", notes for
// Backend/Frontend). RULE-ATT-15 grants this same self-scoped read to
// "qualquer pessoa autenticada", not only students; Professor doesn't get a
// "meu cronograma" screen this round ("Gaps resolvidos — segunda rodada",
// item 8), but that's the Portal frontend simply not calling this endpoint
// yet — the backend contract shouldn't need to change again if/when it
// does. Tightening to role = 'student' now would just need loosening back
// later, for no correctness gain today.
@Injectable()
export class MyScheduleService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async getMySchedule(personId: string): Promise<MyScheduleEntry[]> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    return manager.query(
      `
      SELECT
        cs.id AS "classSessionId",
        cs.class_group_id AS "classGroupId",
        cg.name AS "classGroupName",
        sub.name AS "subjectName",
        COALESCE(cs.room_id, cg.room_id) AS "roomId",
        r.name AS "roomName",
        cs.scheduled_start AS "scheduledStart",
        cs.scheduled_end AS "scheduledEnd",
        cs.status AS "status"
      FROM class_group_enrollment cge
      JOIN class_session cs ON cs.class_group_id = cge.class_group_id
      JOIN class_group cg ON cg.id = cs.class_group_id
      JOIN subject sub ON sub.id = cs.subject_id
      LEFT JOIN room r ON r.id = COALESCE(cs.room_id, cg.room_id)
      WHERE cge.tenant_id = $1 AND cge.person_id = $2
      ORDER BY cs.scheduled_start ASC
      `,
      [tenantId, personId],
    );
  }
}
