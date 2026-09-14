import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { AbsenceJustificationAttachmentService } from '../modules/absence-justification/absence-justification-attachment.service';
import { AbsenceJustificationRlsContextService } from '../modules/absence-justification/absence-justification-rls-context.service';

// RULE-JUST-19: the unattended 30-day attachment retention sweep. There is
// no scheduler/cron/queue in this project for recurring jobs (see
// frequency-warning-read.service.ts's header for the established precedent
// of avoiding one) — the existing idiom for a job with no request to hang
// off is a CLI script invoked per tenant, the same shape as
// session:evaluate/pending:resolve. Actually wiring this to run every day
// (OS cron, a scheduled container task, etc.) is a DevOps decision, out of
// this task's scope.
//
// Revisão de segurança do GUC app.absence_justification_retention_job
// concluída (2026-09-14) — ver a nota completa em
// AbsenceJustificationRlsContextService.applyRetentionJobScope. Aprovado sem
// ressalvas.
async function main() {
  const [tenantId] = process.argv.slice(2);
  if (!tenantId) {
    console.error('Usage: npm run absence-justification:retention-sweep -- <tenantId>');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const rlsContext = app.get(AbsenceJustificationRlsContextService);
  const attachmentService = app.get(AbsenceJustificationAttachmentService);

  const deletedCount = await tenantContext.runWithTenant(tenantId, async () => {
    await rlsContext.applyRetentionJobScope();
    return attachmentService.sweepDueAttachments();
  });

  console.log(`Retention sweep complete: ${deletedCount} attachment(s) eliminated.`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
