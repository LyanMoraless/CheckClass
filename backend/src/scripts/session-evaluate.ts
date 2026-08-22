import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
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

  await tenantContext.runWithTenant(tenantId, () => engine.evaluateSession(classSessionId));
  console.log('Evaluation complete.');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
