import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonManagementController } from './person-management.controller';
import { PersonManagementService } from './person-management.service';

@Module({
  imports: [AuthModule],
  controllers: [PersonManagementController],
  providers: [PersonManagementService],
})
export class PersonManagementModule {}
