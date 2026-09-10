import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { AttendanceAnnualConsolidationService } from '../modules/attendance-retention/attendance-annual-consolidation.service';
import { AttendanceRetentionRlsContextService } from '../modules/attendance-retention/attendance-retention-rls-context.service';

// RULE-RET-02 — the unattended annual consolidation. Auto-conditional (runs,
// checks whether 12 un-consolidated monthly documents already exist for this
// tenant, no-op otherwise) — same "simple script over a scheduler" reasoning
// the Frente 10 technology decision applied to both jobs (item 2). Safe to
// re-run on every invocation without tracking "did I already run this year".
async function main() {
  const [tenantId] = process.argv.slice(2);
  if (!tenantId) {
    console.error('Usage: npm run attendance-retention:consolidate-annual -- <tenantId>');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const rlsContext = app.get(AttendanceRetentionRlsContextService);
  const consolidationService = app.get(AttendanceAnnualConsolidationService);

  await tenantContext.runWithTenant(tenantId, async () => {
    await rlsContext.applyRetentionJobScope();

    const outcome = await consolidationService.consolidateNext(tenantId);
    if (outcome.status === 'not_enough_monthly_documents') {
      console.log(`Only ${outcome.unconsolidatedCount} unconsolidated monthly document(s) — need 12. Nothing done.`);
      return;
    }
    console.log(
      `Annual closure ${outcome.document.id} generated, consolidating ${outcome.consolidatedMonthlyDocumentIds.length} monthly documents.`,
    );
  });

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
