import { Module } from '@nestjs/common';
import { TenantConfigModule } from '../config/tenant-config.module';
import { ClassSessionService } from './class-session.service';

@Module({
  imports: [TenantConfigModule],
  providers: [ClassSessionService],
  exports: [ClassSessionService],
})
export class ClassSessionModule {}
