import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { AttendanceMonthlyClosureService } from '../modules/attendance-retention/attendance-monthly-closure.service';
import { AttendancePurgeService } from '../modules/attendance-retention/attendance-purge.service';
import { AttendanceRetentionRlsContextService } from '../modules/attendance-retention/attendance-retention-rls-context.service';
import { parseYearMonth } from '../modules/attendance-retention/attendance-retention-month.util';

// RULE-RET-01 — the unattended Fechamento Mensal, immediately followed by
// the Expurgo for the SAME (tenant, month) once (and only if) the closure
// document is confirmed persisted (architecture-overview.md, Frente 10,
// Estrutura proposta items 1/3: "geração e expurgo são passos sequenciais,
// nunca o inverso"). One script, two distinct services underneath
// (AttendanceMonthlyClosureService / AttendancePurgeService) — same
// separation the Frente 07 retention sweep already established between
// calculating a retention date and actually eliminating.
//
// Same unattended-CLI-script idiom as session:evaluate/pending:resolve/
// absence-justification:retention-sweep (RULE-JUST-19 precedent): real
// periodic scheduling (OS cron, deploy orchestrator) is a DevOps decision,
// out of this script's scope. Safe to re-run: closeMonth is idempotent per
// (tenant, month), and purgeMonth is a no-op once nothing eligible remains.
async function main() {
  const [tenantId, yearMonth] = process.argv.slice(2);
  if (!tenantId || !yearMonth) {
    console.error('Usage: npm run attendance-retention:close-month -- <tenantId> <yearMonth (YYYY-MM)>');
    process.exitCode = 1;
    return;
  }

  const { year, month } = parseYearMonth(yearMonth);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const rlsContext = app.get(AttendanceRetentionRlsContextService);
  const closureService = app.get(AttendanceMonthlyClosureService);
  const purgeService = app.get(AttendancePurgeService);

  await tenantContext.runWithTenant(tenantId, async () => {
    await rlsContext.applyRetentionJobScope();

    const closureOutcome = await closureService.closeMonth(tenantId, year, month);
    if (closureOutcome.status === 'not_yet_eligible') {
      console.log(`Month ${yearMonth} is not yet eligible for closure (${closureOutcome.reason}). Nothing done.`);
      return;
    }
    console.log(
      closureOutcome.status === 'created'
        ? `Closure document generated for ${yearMonth}: ${JSON.stringify(closureOutcome.document.summary)}`
        : `Closure document for ${yearMonth} already existed (id ${closureOutcome.document.id}) — proceeding to purge.`,
    );

    const purgeOutcome = await purgeService.purgeMonth(tenantId, year, month);
    if (purgeOutcome.status === 'skipped') {
      console.log(`Purge skipped for ${yearMonth}: ${purgeOutcome.reason}`);
      return;
    }
    console.log(`Purge complete for ${yearMonth}: ${JSON.stringify(purgeOutcome.counts)}`);
  });

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
