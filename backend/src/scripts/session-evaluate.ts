import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SessionAttendanceConsolidationEntity } from '../database/entities';
import { TenantContextService } from '../database/tenant-context.service';
import { AttendanceFrequencyEngineService } from '../modules/attendance-frequency/attendance-frequency-engine.service';
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
    await engine.evaluateSession(classSessionId);

    // Controle B stacked on Controle A (RULE-FREQ-06), inside the SAME
    // runWithTenant transaction and strictly after the evaluation writes —
    // the recompute is query-driven, so running it first would read the
    // session's pre-evaluation state.
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
      await frequencyEngine.recalculateForSessionPerson(classSessionId, consolidation.personId);
    }
  });
  console.log('Evaluation complete.');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
