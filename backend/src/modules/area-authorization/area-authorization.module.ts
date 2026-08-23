import { Module } from '@nestjs/common';
import { AreaAuthorizationService } from './area-authorization.service';

@Module({
  providers: [AreaAuthorizationService],
  exports: [AreaAuthorizationService],
})
export class AreaAuthorizationModule {}
