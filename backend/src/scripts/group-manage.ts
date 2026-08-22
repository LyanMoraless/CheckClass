import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantContextService } from '../database/tenant-context.service';
import { Permission } from '../modules/auth/permission.enum';
import { PermissionGroupService } from '../modules/auth/permission-group.service';

// Dev-only: exercises the real PermissionGroupService (institution-defined
// permission groups, confirmed 2026-08-22 — coexists with, does not
// replace, RULE-ATT-12's leadership chain for pending-review resolution).
async function main() {
  const [tenantId, mode, ...rest] = process.argv.slice(2);
  if (!tenantId || !mode) {
    console.error(
      'Usage:\n' +
        '  npm run group:manage -- <tenantId> create <name> <permissionCodesCsv>\n' +
        '  npm run group:manage -- <tenantId> assign <personId> <permissionGroupId>\n' +
        '  npm run group:manage -- <tenantId> check <personId> <permissionCode>',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const tenantContext = app.get(TenantContextService);
  const permissionGroupService = app.get(PermissionGroupService);

  await tenantContext.runWithTenant(tenantId, async () => {
    switch (mode) {
      case 'create': {
        const [name, permissionCodesCsv] = rest;
        const permissions = (permissionCodesCsv ?? '').split(',').filter(Boolean) as Permission[];
        const group = await permissionGroupService.createGroup(name, permissions);
        console.log('permission_group id:', group.id);
        break;
      }
      case 'assign': {
        const [personId, permissionGroupId] = rest;
        await permissionGroupService.assignPersonToGroup(personId, permissionGroupId);
        console.log('Assigned.');
        break;
      }
      case 'check': {
        const [personId, permissionCode] = rest;
        const result = await permissionGroupService.hasPermission(personId, permissionCode as Permission);
        console.log('hasPermission:', result);
        break;
      }
      default:
        throw new Error(`Unknown mode "${mode}" — use create, assign, or check`);
    }
  });

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
