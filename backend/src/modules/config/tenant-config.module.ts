import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigController } from './config.controller';
import { TenantConfigService } from './tenant-config.service';

// Named TenantConfigModule, not ConfigModule, to avoid clashing with
// @nestjs/config's ConfigModule wherever both get imported together.
@Module({
  imports: [AuthModule],
  controllers: [ConfigController],
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
