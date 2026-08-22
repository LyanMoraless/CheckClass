import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { AuthService } from '../modules/auth/auth.service';

// Dev-only: exercises the real AuthService.login() — CPF resolved across
// tenants via resolve_person_by_cpf(), password checked with bcrypt.
async function main() {
  const [cpf, password] = process.argv.slice(2);
  if (!cpf || !password) {
    console.error('Usage: npm run login:test -- <cpf> <password>');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  const authService = app.get(AuthService);

  const result = await authService.login(cpf, password);
  console.log('Login OK. personId:', result.personId, 'tenantId:', result.tenantId);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
