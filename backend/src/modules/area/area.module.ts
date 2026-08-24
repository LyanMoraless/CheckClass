import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';

@Module({
  imports: [AuthModule],
  controllers: [AreaController],
  providers: [AreaService],
  exports: [AreaService],
})
export class AreaModule {}
