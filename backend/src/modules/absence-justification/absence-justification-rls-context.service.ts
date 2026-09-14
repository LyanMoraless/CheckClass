import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../database/tenant-context.service';

// Additive, module-scoped GUC setter — same posture as ExamRlsContextService
// and for the same reason (teaching TenantContextService about person_id
// generically would silently change the context of every unrelated
// request). app.person_id is the SAME GUC NAME the Exam Area already sets
// (see the AddAbsenceJustification migration header, "reused from the Exam
// Area") — reused by name only, not by import: the two bounded contexts stay
// decoupled, each with its own small setter.
//
// Unlike the Exam Area, there is no separate "management scope" call here.
// Every request that reaches this module's controllers (student OR
// professor) sets app.person_id to ITS OWN caller, and the six tables' RLS
// policies (student_ownership vs teacher_subject_scope) each read that same
// GUC differently — whichever policy matches decides what the caller can
// see/write. There is nothing to "turn on" beyond identity itself; this
// module deliberately never sets app.absence_justification_management_scope
// (Coordenação/Direção read surfaces are out of this round's scope — see the
// Backend Implementation Summary).
@Injectable()
export class AbsenceJustificationRlsContextService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async applyPersonScope(personId: string): Promise<void> {
    await this.tenantContext.getManager().query("SELECT set_config('app.person_id', $1, true)", [personId]);
  }

  // Door for the unattended 30-day retention sweep (RULE-JUST-19) — see
  // src/scripts/absence-justification-attachment-retention-sweep.ts, the
  // only caller.
  //
  // Revisão de segurança concluída (2026-09-14), junto com
  // app.attendance_retention_job, como a arquitetura recomendava
  // (architecture-overview.md, Frente 10, "Estrutura proposta" item 8):
  // aprovado sem ressalvas. set_config usa valor literal fixo (nunca input
  // de usuário) com is_local=true (SET LOCAL), sempre dentro da mesma
  // transação de TenantContextService.runWithTenant — não vaza entre
  // conexões pooled. Só é chamado pelo script CLI standalone
  // absence-justification-attachment-retention-sweep.ts, nunca por
  // controller/interceptor/guard do pipeline HTTP — sem caminho de
  // escalação a partir de uma requisição autenticada normal.
  async applyRetentionJobScope(): Promise<void> {
    await this.tenantContext
      .getManager()
      .query("SELECT set_config('app.absence_justification_retention_job', 'on', true)");
  }

  // Door for AbsenceJustificationAttachmentService.download()'s denial-log
  // existence check (RULE-JUST-11 item 2, "Exceptions: Nenhuma") — see the
  // AddAbsenceJustificationAccessLogLookupScope migration header. Narrower
  // in TIME than applyRetentionJobScope: this one is meant to be turned back
  // off (clearAccessLogLookupScope) immediately after the single query it
  // exists for, not left set for the rest of the request.
  async applyAccessLogLookupScope(): Promise<void> {
    await this.tenantContext
      .getManager()
      .query("SELECT set_config('app.absence_justification_access_log_scope', 'on', true)");
  }

  async clearAccessLogLookupScope(): Promise<void> {
    await this.tenantContext
      .getManager()
      .query("SELECT set_config('app.absence_justification_access_log_scope', 'off', true)");
  }
}
