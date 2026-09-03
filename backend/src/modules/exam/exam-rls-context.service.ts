import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

// Fulfils the RLS contract the AddExamArea migration documents at its top.
// Four exam tables (exam_session, exam_answer, exam_answer_selected_option,
// exam_session_event) are fail-closed: on top of app.tenant_id they read two
// GUCs that TenantContextService does not set, and with neither one set they
// return zero rows and reject writes.
//
// Deliberately an ADDITIVE service instead of a change to
// TenantContextService: every other module in the codebase runs with
// app.tenant_id alone, and teaching that shared service about person
// ownership and exam management scope would silently change the context of
// requests that have nothing to do with exams. Here the extra GUCs are set
// only by exam code paths, and only where the rule says they may be.
//
// Both GUCs are transaction-local (set_config's is_local = true), so they
// live and die with the transaction TenantContextService.runWithTenant
// already opens around the request — nothing leaks back into the connection
// pool for the next request to inherit.
@Injectable()
export class ExamRlsContextService {
  constructor(private readonly tenantContext: TenantContextService) {}

  // Student-scoped requests: the row owner is the authenticated person, who
  // always comes from the verified JWT (never from a parameter).
  async applyStudentScope(personId: string): Promise<void> {
    await this.tenantContext.getManager().query("SELECT set_config('app.person_id', $1, true)", [personId]);
  }

  // Management/audit requests. The GUC is a MARKER that authorization
  // already happened, not the authorization itself — call it only after
  // LeadershipScopeService has approved the request (RULE-EXAM-16), which is
  // why the only caller is ExamAccessService, right after its check.
  async applyManagementScope(): Promise<void> {
    await this.tenantContext.getManager().query("SELECT set_config('app.exam_management_scope', 'on', true)");
  }
}
