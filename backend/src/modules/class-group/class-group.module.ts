import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ClassGroupController } from './class-group.controller';
import { ClassGroupService } from './class-group.service';

@Module({
  imports: [AuthModule],
  controllers: [ClassGroupController],
  providers: [ClassGroupService],
  exports: [ClassGroupService],
})
export class ClassGroupModule {}
