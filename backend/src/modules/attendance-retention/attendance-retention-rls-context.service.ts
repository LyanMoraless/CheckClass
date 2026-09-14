import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

// Door for the three unattended Frente 10 jobs (Fechamento Mensal, Expurgo,
// Consolidação Anual — src/scripts/attendance-retention-*.ts) to reach
// attendance_closure_document. See the AddAttendanceRetention migration
// header: that table has NO interactive read policy today — reachable ONLY
// through this GUC — because Frente 10 Open Question 4 ("quem pode baixar o
// documento de fechamento") is still unresolved. Same mechanism, same naming
// convention, as AbsenceJustificationRlsContextService.applyRetentionJobScope
// for app.absence_justification_retention_job.
//
// The four RULE-RET-01 source tables (raw_identification_event/
// identification_checkin/presence_interval/session_attendance_consolidation)
// need NO GUC of their own for this job: they already grant ordinary
// SELECT/DELETE to the app role under the plain tenant_isolation policy
// (InitSchema migration), which app.tenant_id alone (already set by
// TenantContextService.runWithTenant) already satisfies.
//
// Revisão de segurança concluída (2026-09-14), junto com
// app.absence_justification_retention_job, como a arquitetura recomendava
// (architecture-overview.md, Frente 10, "Estrutura proposta" item 8):
// aprovado sem ressalvas. set_config usa valor literal fixo (nunca input de
// usuário) com is_local=true (SET LOCAL), sempre dentro da mesma transação
// de TenantContextService.runWithTenant — não vaza entre conexões pooled.
// Só é chamado pelos scripts CLI standalone de Frente 10
// (attendance-retention-close-month.ts, attendance-retention-consolidate-
// annual.ts), nunca por controller/interceptor/guard do pipeline HTTP — sem
// caminho de escalação a partir de uma requisição autenticada normal.
@Injectable()
export class AttendanceRetentionRlsContextService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async applyRetentionJobScope(): Promise<void> {
    await this.tenantContext.getManager().query("SELECT set_config('app.attendance_retention_job', 'on', true)");
  }
}
