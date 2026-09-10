import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DeviceIdentityModule } from '../device-identity/device-identity.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { DeviceBindingConfigService } from './device-binding-config.service';
import { DeviceBindingController } from './device-binding.controller';
import { DeviceBindingService } from './device-binding.service';

// Frente 12 — ciclo de vida do vínculo pessoa<->máquina (RULE-DEV-06/07/08/
// 10/13). Imports DeviceIdentityModule (mão única: device-binding consumes
// DeviceCredentialService, device-identity never imports back). Exports
// DeviceBindingService: AttendanceRulesModule consumes it as a read-only
// primitive (RULE-DEV-09), same shape as Motor de Regras -> Serviço de
// Configuração.
@Module({
  imports: [AuthModule, LeadershipScopeModule, DeviceIdentityModule],
  controllers: [DeviceBindingController],
  providers: [DeviceBindingService, DeviceBindingConfigService],
  exports: [DeviceBindingService],
})
export class DeviceBindingModule {}
