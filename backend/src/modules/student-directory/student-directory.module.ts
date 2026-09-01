import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { StudentDirectoryController } from './student-directory.controller';
import { StudentDirectoryService } from './student-directory.service';

@Module({
  imports: [AuthModule],
  controllers: [StudentDirectoryController],
  providers: [StudentDirectoryService],
})
export class StudentDirectoryModule {}
