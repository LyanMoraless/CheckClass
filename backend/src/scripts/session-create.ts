import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { ClassSessionService } from '../modules/class-session/class-session.service';

// Dev-only: exercises the real ClassSessionService (config resolution +
// snapshot), the only sanctioned way class_session rows should be created.
async function main() {
  const [tenantId, classGroupId, subjectId, roomId, scheduledStart, scheduledEnd, authenticatedPersonId] =
    process.argv.slice(2);
  if (!tenantId || !classGroupId || !subjectId || !roomId || !scheduledStart || !scheduledEnd || !authenticatedPersonId) {
    console.error(
      'Usage: npm run session:create -- <tenantId> <classGroupId> <subjectId> <roomId> <scheduledStartISO> <scheduledEndISO> <authenticatedPersonId>',
    );
    console.error(
      '  subjectId must be one of the turma\'s linked matérias (RULE-INST-14) — see GET /v1/class-groups/<id>/subjects.',
    );
    console.error(
      '  authenticatedPersonId must have leadership authority (RULE-INST-09) over the turma\'s course — e.g. the tenant\'s root admin, seeded with institution-wide authority at onboarding.',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const classSessionService = app.get(ClassSessionService);

  await tenantContext.runWithTenant(tenantId, async () => {
    const session = await classSessionService.createSession(
      {
        classGroupId,
        subjectId,
        roomId,
        scheduledStart: new Date(scheduledStart),
        scheduledEnd: new Date(scheduledEnd),
      },
      authenticatedPersonId,
    );
    console.log('class_session id:', session.id);
    console.log('min_attendance_percentage_snapshot:', session.minAttendancePercentageSnapshot);
    console.log('tolerance_minutes_snapshot:', session.toleranceMinutesSnapshot);
    console.log('post_tolerance_behavior_snapshot:', session.postToleranceBehaviorSnapshot);
  });

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
