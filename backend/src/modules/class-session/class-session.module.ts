import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TenantConfigModule } from '../config/tenant-config.module';
import { ClassSessionController } from './class-session.controller';
import { ClassSessionService } from './class-session.service';

@Module({
  imports: [TenantConfigModule, AuthModule],
  controllers: [ClassSessionController],
  providers: [ClassSessionService],
  exports: [ClassSessionService],
})
export class ClassSessionModule {}
