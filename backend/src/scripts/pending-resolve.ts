import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { PendingReviewDecision, PendingReviewService } from '../modules/pending-review/pending-review.service';

// Dev-only: exercises the real PendingReviewService (RULE-ATT-11/12
// authorization), not a substitute for the institutional-management admin
// UI (priority 2 — no human-user auth exists in this backend yet).
async function main() {
  const [tenantId, pendingReviewId, resolvingPersonId, decision, note] = process.argv.slice(2);
  if (!tenantId || !pendingReviewId || !resolvingPersonId || !decision) {
    console.error('Usage: npm run pending:resolve -- <tenantId> <pendingReviewId> <resolvingPersonId> <present|absent> [note]');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const pendingReviewService = app.get(PendingReviewService);

  await tenantContext.runWithTenant(tenantId, () =>
    pendingReviewService.resolve(pendingReviewId, resolvingPersonId, decision as PendingReviewDecision, note),
  );
  console.log('Resolved.');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
