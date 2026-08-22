import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { AttendanceRegisterService } from '../modules/attendance-register/attendance-register.service';

// Dev-only: exercises the real AttendanceRegisterService. Not a substitute
// for the Frontend/Mobile query API — that needs real user authentication
// (priority 2, not built yet) to scope who can see whose attendance.
async function main() {
  const [tenantId, mode, id, extra] = process.argv.slice(2);
  if (!tenantId || !mode || !id) {
    console.error('Usage: npm run register:query -- <tenantId> <session|person|class-group> <id> [classGroupId (for person mode)]');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const registerService = app.get(AttendanceRegisterService);

  await tenantContext.runWithTenant(tenantId, async () => {
    switch (mode) {
      case 'session':
        console.log(JSON.stringify(await registerService.getSessionRegister(id), null, 2));
        break;
      case 'person':
        console.log(JSON.stringify(await registerService.getPersonHistory(id, extra), null, 2));
        break;
      case 'class-group':
        console.log(JSON.stringify(await registerService.getClassGroupSummary(id), null, 2));
        break;
      default:
        throw new Error(`Unknown mode "${mode}" — use session, person, or class-group`);
    }
  });

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
