import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TenantBootstrapService } from '../modules/auth/tenant-bootstrap.service';

// Dev-only: exercises the real TenantBootstrapService. This is also the
// only way an institution's root account gets created — not a throwaway.
async function main() {
  const [institutionName, institutionType, rootFullName, rootCpf, rootPassword] = process.argv.slice(2);
  if (!institutionName || !institutionType || !rootFullName || !rootCpf || !rootPassword) {
    console.error(
      'Usage: npm run tenant:create -- <institutionName> <institutionType> <rootFullName> <rootCpf> <rootPassword>',
    );
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const bootstrapService = app.get(TenantBootstrapService);

  const result = await bootstrapService.createTenant({
    institutionName,
    institutionType,
    rootFullName,
    rootCpf,
    rootPassword,
  });

  console.log('tenantId:', result.tenantId);
  console.log('rootPersonId:', result.rootPersonId);
  console.log('rootPermissionGroupId:', result.rootPermissionGroupId);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
