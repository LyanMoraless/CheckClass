import { Module } from '@nestjs/common';
import { TenantConfigService } from './tenant-config.service';

// Named TenantConfigModule, not ConfigModule, to avoid clashing with
// @nestjs/config's ConfigModule wherever both get imported together.
@Module({
  providers: [TenantConfigService],
  exports: [TenantConfigService],
})
export class TenantConfigModule {}
