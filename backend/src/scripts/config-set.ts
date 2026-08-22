import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { ConfigScopeType } from '../modules/config/config-scope-type.enum';
import { PostToleranceBehavior } from '../modules/config/post-tolerance-behavior.enum';
import { TenantConfigService } from '../modules/config/tenant-config.service';

// Dev-only: exercises the real TenantConfigService (resolution + RULE-ATT-14
// validation), not a substitute for the institutional-management admin UI
// (priority 2, not built yet — no human-user auth exists in this backend).
async function main() {
  const [tenantId, scopeType, scopeIdArg, minPct, toleranceMin, postBehavior, factorCodesCsv] = process.argv.slice(2);
  if (!tenantId || !scopeType || !minPct || !toleranceMin || !postBehavior) {
    console.error(
      'Usage: npm run config:set -- <tenantId> <institution|course|class_group> <scopeId|-> <minPct> <toleranceMin> <block_checkin|deny_presence|register_only> [factorCodesCsv]',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const configService = app.get(TenantConfigService);

  await tenantContext.runWithTenant(tenantId, async () => {
    const config = await configService.upsertConfig({
      scopeType: scopeType as ConfigScopeType,
      scopeId: scopeIdArg === '-' ? null : scopeIdArg,
      minAttendancePercentage: Number(minPct),
      toleranceMinutes: Number(toleranceMin),
      postToleranceBehavior: postBehavior as PostToleranceBehavior,
    });
    console.log('attendance_config id:', config.id);

    if (factorCodesCsv) {
      const manager = tenantContext.getManager();
      const codes = factorCodesCsv.split(',').map((code) => code.trim());
      const factorIds: string[] = [];
      for (const code of codes) {
        const rows: Array<{ id: string }> = await manager.query(
          'SELECT id FROM attendance_factor_type WHERE code = $1 LIMIT 1',
          [code],
        );
        if (!rows[0]) {
          throw new Error(`No attendance_factor_type found with code "${code}" visible to this tenant`);
        }
        factorIds.push(rows[0].id);
      }
      await configService.setRequiredFactors(config.id, factorIds);
      console.log('required factors set:', codes.join(', '));
    }
  });

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
