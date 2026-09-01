import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

export interface MyScheduleEntry {
  classSessionId: string;
  classGroupId: string;
  roomId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
}

// RULE-ATT-15: self-scoped access to "horários/calendário" (schedule/calendar)
// — a genuinely new read, but pure composition of existing entities: the
// person's own class_group_enrollment rows joined to class_session, the same
// two tables AttendanceRegisterService already reads for the admin-facing
// register. No new business logic, no new persisted state. Deliberately its
// own tiny service (not folded into AttendanceRegisterService, which is
// consumed by the permission-gated admin routes) so the self-scoped route
// family in MeController stays a clean, separate composition root.
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
        COALESCE(cs.room_id, cg.room_id) AS "roomId",
        cs.scheduled_start AS "scheduledStart",
        cs.scheduled_end AS "scheduledEnd"
      FROM class_group_enrollment cge
      JOIN class_session cs ON cs.class_group_id = cge.class_group_id
      JOIN class_group cg ON cg.id = cs.class_group_id
      WHERE cge.tenant_id = $1 AND cge.person_id = $2
      ORDER BY cs.scheduled_start ASC
      `,
      [tenantId, personId],
    );
  }
}
