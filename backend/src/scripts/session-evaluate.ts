import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SessionAttendanceConsolidationEntity } from '../database/entities';
import { TenantContextService } from '../database/tenant-context.service';
import { AttendanceFrequencyEngineService, ConsolidationStatus } from '../modules/attendance-frequency/attendance-frequency-engine.service';
import { AttendanceRulesEngineService } from '../modules/attendance-rules/attendance-rules-engine.service';

// Dev-only: manually triggers the Motor de Regras for one session. There is
// no automatic "session just ended" scheduler yet (see backend/README.md) —
// wiring that up is a pending piece, not solved by this script.
async function main() {
  const [tenantId, classSessionId] = process.argv.slice(2);
  if (!tenantId || !classSessionId) {
    console.error('Usage: npm run session:evaluate -- <tenantId> <classSessionId>');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const engine = app.get(AttendanceRulesEngineService);
  const frequencyEngine = app.get(AttendanceFrequencyEngineService);

  await tenantContext.runWithTenant(tenantId, async () => {
    // Frente 10: captured BEFORE evaluateSession runs, so recalculateFor
    // SessionPerson's incremental aggregate can correct itself by the exact
    // DIFFERENCE this (re-)evaluation makes for each person, not a blind
    // "+1" — this script is re-runnable (dev-only, see the file header), so
    // a person's row here may already have a definitive status from a
    // previous run, not just 'pending' or missing.
    const previousStatusByPerson = new Map<string, string>();
    const existingBefore = await tenantContext
      .getManager()
      .getRepository(SessionAttendanceConsolidationEntity)
      .find({ where: { classSessionId }, select: ['personId', 'status'] });
    for (const row of existingBefore) {
      previousStatusByPerson.set(row.personId, row.status);
    }

    await engine.evaluateSession(classSessionId);

    // Controle B stacked on Controle A (RULE-FREQ-06), inside the SAME
    // runWithTenant transaction and strictly after the evaluation writes —
    // the recompute reads each row's NEW status itself (single-row lookup,
    // Frente 10), so running it first would read the session's
    // pre-evaluation state.
    //
    // The roster is re-derived here from the consolidation rows the
    // evaluation just wrote, rather than by asking the Controle A engine for
    // the people it touched: evaluateSession returns void and stays at a zero
    // diff (its own architectural commitment), so Controle B reads its output
    // instead of changing its signature. Those rows ARE the set of people
    // this session produced a verdict for — including the pending ones, whose
    // recompute correctly leaves them out of the denominator
    // (RULE-FREQ-05.1) until a human resolves them through
    // PendingReviewService.
    const consolidations = await tenantContext
      .getManager()
      .getRepository(SessionAttendanceConsolidationEntity)
      .find({ where: { classSessionId }, select: ['personId'] });

    for (const consolidation of consolidations) {
      const previousStatus = (previousStatusByPerson.get(consolidation.personId) ?? null) as ConsolidationStatus | null;
      await frequencyEngine.recalculateForSessionPerson(classSessionId, consolidation.personId, previousStatus);
    }
  });
  console.log('Evaluation complete.');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
