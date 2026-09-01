import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstitutionOnboardingController } from './institution-onboarding.controller';
import { InstitutionOnboardingService } from './institution-onboarding.service';

@Module({
  // AuthModule for TenantBootstrapService, the only sanctioned tenant
  // creator (already exported by AuthModule). DataSource comes from the
  // globally-exported DatabaseModule, same as TenantBootstrapService itself.
  imports: [AuthModule],
  controllers: [InstitutionOnboardingController],
  providers: [InstitutionOnboardingService],
})
export class InstitutionOnboardingModule {}
