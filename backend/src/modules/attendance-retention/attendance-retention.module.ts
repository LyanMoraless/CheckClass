import { Module } from '@nestjs/common';
import { AttendanceAnnualConsolidationService } from './attendance-annual-consolidation.service';
import { AttendanceMonthlyClosureService } from './attendance-monthly-closure.service';
import { AttendancePurgeService } from './attendance-purge.service';
import { AttendanceRetentionArchiveLookupService } from './attendance-retention-archive-lookup.service';
import { AttendanceRetentionPendingGateService } from './attendance-retention-pending-gate.service';
import { AttendanceRetentionRlsContextService } from './attendance-retention-rls-context.service';
import { AttendanceRetentionStorageService } from './attendance-retention-storage.service';

// Frente 10 — Conformidade LGPD e retenção (RULE-RET-01/02). Synchronous
// bounded context, no queue/event involvement — same family as Área de
// Provas/Controle B/Justificativa de Faltas (architecture-overview.md,
// "Decisão de arquitetura — Conformidade LGPD e retenção, Frente 10",
// "Padrão arquitetural aplicado").
//
// No controller here: this round's actors are the two unattended CLI
// scripts (attendance-retention:close-month, which runs the Fechamento
// Mensal and, right after, the Expurgo for the same month; and
// attendance-retention:consolidate-annual — see src/scripts/) and, on the
// read side, SelfServiceModule (me.controller.ts, via
// AttendanceRetentionArchiveLookupService exported below). No download
// endpoint exists yet — Open Question 4 ("quem pode baixar o documento de
// fechamento") is unresolved, and attendance_closure_document was modelled
// by the Database Agent with no interactive read policy at all; forcing an
// endpoint without an access policy would be inventing one instead of
// implementing an approved decision.
@Module({
  providers: [
    AttendanceRetentionRlsContextService,
    AttendanceRetentionPendingGateService,
    AttendanceRetentionStorageService,
    AttendanceMonthlyClosureService,
    AttendancePurgeService,
    AttendanceAnnualConsolidationService,
    AttendanceRetentionArchiveLookupService,
  ],
  // RlsContextService/MonthlyClosureService/PurgeService/
  // AnnualConsolidationService are exported for the CLI scripts, which build
  // their own application context via NestFactory.createApplicationContext —
  // same pattern as absence-justification-attachment-retention-sweep.ts.
  // ArchiveLookupService is exported for SelfServiceModule's extension of
  // /v1/me/attendance (Estrutura proposta item 6).
  exports: [
    AttendanceRetentionRlsContextService,
    AttendanceMonthlyClosureService,
    AttendancePurgeService,
    AttendanceAnnualConsolidationService,
    AttendanceRetentionArchiveLookupService,
  ],
})
export class AttendanceRetentionModule {}
