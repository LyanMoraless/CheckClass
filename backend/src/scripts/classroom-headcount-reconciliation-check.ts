import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { ClassroomHeadcountReconciliationService } from '../modules/classroom-headcount-reconciliation/classroom-headcount-reconciliation.service';

// RULE-PRES-10/11/12 (Bloco 4 — Contagem por câmera como cruzamento). Same
// unattended-CLI-script idiom as attendance-retention:close-month/
// absence-justification:retention-sweep: real periodic scheduling — every 15
// minutes, per RULE-SEC-05/PRES-11's fixed camera-capture cadence — is a
// DevOps decision (OS cron, deploy orchestrator), out of this script's scope.
//
// ENTIRELY READ-ONLY: this script issues no write of any kind (see
// ClassroomHeadcountReconciliationService's own header for how "confirmada
// em duas contagens consecutivas" is derived from CAMERA_COUNT readings'
// own history instead of persisted job state). The "alert" this script
// fires is the console.warn below — an observable event per run, same idiom
// as attendance-retention's own reporting — plus the exact same computation
// exposed live to the professor via GET /v1/me/class-sessions/:id/
// headcount-alert (self-service module), so a professor doesn't have to
// wait for this script's next run to see where things stand.
async function main() {
  const [tenantId] = process.argv.slice(2);
  if (!tenantId) {
    console.error('Usage: npm run classroom-headcount:reconcile -- <tenantId>');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const reconciliationService = app.get(ClassroomHeadcountReconciliationService);

  await tenantContext.runWithTenant(tenantId, async () => {
    const outcomes = await reconciliationService.evaluateInProgressSessions();
    if (outcomes.length === 0) {
      console.log('No class sessions currently in progress for this tenant.');
      return;
    }

    for (const outcome of outcomes) {
      if (!outcome.alertActive) {
        console.log(
          `class_session ${outcome.classSessionId}: no confirmed divergence (windows examined: ${outcome.windows.length}).`,
        );
        continue;
      }
      // RULE-PRES-10/11: the three numbers, from the MOST RECENT confirmed
      // window (windows[0] — findRecentCameraReadings orders most-recent
      // first).
      const [latest] = outcome.windows;
      console.warn(
        `ALERT class_session ${outcome.classSessionId} (room ${outcome.roomId}): headcount divergence >= 5 ` +
          `confirmed in 2 consecutive camera readings — camera=${latest.cameraCount}, ` +
          `app_checkin=${latest.appCheckinCount}, room_presence=${latest.roomPresenceCount} (RULE-PRES-10/11).`,
      );
    }
  });

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
