import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LeadershipScopeModule } from '../leadership-scope/leadership-scope.module';
import { DeviceCredentialController } from './device-credential.controller';
import { DeviceCredentialService } from './device-credential.service';
import { InstitutionalMachineController } from './institutional-machine.controller';
import { InstitutionalMachineService } from './institutional-machine.service';
import { PersonalDeviceController } from './personal-device.controller';
import { PersonalDeviceService } from './personal-device.service';

// Frente 12 — inventário de máquina institucional + BYOD + matrícula/
// verificação de credencial WebAuthn (RULE-DEV-01..05/15/17/18). Exports
// DeviceCredentialService: device-binding's login ceremony consumes it
// (mão única — device-identity never imports device-binding back).
@Module({
  imports: [AuthModule, LeadershipScopeModule],
  controllers: [InstitutionalMachineController, PersonalDeviceController, DeviceCredentialController],
  providers: [InstitutionalMachineService, PersonalDeviceService, DeviceCredentialService],
  exports: [DeviceCredentialService],
})
export class DeviceIdentityModule {}
