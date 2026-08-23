import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SecurityIncidentController } from './security-incident.controller';
import { SecurityIncidentService } from './security-incident.service';

@Module({
  imports: [AuthModule],
  controllers: [SecurityIncidentController],
  providers: [SecurityIncidentService],
  exports: [SecurityIncidentService],
})
export class SecurityIncidentModule {}
