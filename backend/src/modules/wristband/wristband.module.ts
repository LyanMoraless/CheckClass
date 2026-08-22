import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WristbandController } from './wristband.controller';
import { WristbandService } from './wristband.service';

@Module({
  imports: [AuthModule],
  controllers: [WristbandController],
  providers: [WristbandService],
  exports: [WristbandService],
})
export class WristbandModule {}
