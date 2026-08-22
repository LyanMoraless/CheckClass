import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { DeviceEntity } from '../../database/entities';
import { TenantContextService } from '../../database/tenant-context.service';

export interface RegisterDeviceInput {
  roomId?: string;
  deviceType: string;
  externalIdentifier: string;
}

export interface RegisteredDevice {
  deviceId: string;
  // Returned once, at registration time, exactly like the device:create
  // dev script this replaces for real usage — never recoverable afterwards,
  // since only the SHA-256 hash of the secret is persisted.
  apiKey: string;
}

@Injectable()
export class DeviceService {
  constructor(private readonly tenantContext: TenantContextService) {}

  async register(input: RegisterDeviceInput): Promise<RegisteredDevice> {
    const manager = this.tenantContext.getManager();
    const tenantId = this.tenantContext.getTenantId();

    const apiKeyId = randomBytes(16).toString('hex');
    const secret = randomBytes(32).toString('hex');
    const apiKeySecretHash = createHash('sha256').update(secret).digest('hex');

    const repository = manager.getRepository(DeviceEntity);
    const device = await repository.save(
      repository.create({
        tenantId,
        roomId: input.roomId ?? null,
        deviceType: input.deviceType,
        externalIdentifier: input.externalIdentifier,
        apiKeyId,
        apiKeySecretHash,
      }),
    );

    return { deviceId: device.id, apiKey: `${apiKeyId}.${secret}` };
  }

  async list(): Promise<Array<Omit<DeviceEntity, 'apiKeySecretHash'>>> {
    const manager = this.tenantContext.getManager();
    const devices = await manager.getRepository(DeviceEntity).find();
    // Never return the secret hash over the API, even hashed.
    return devices.map(({ apiKeySecretHash: _apiKeySecretHash, ...rest }) => rest);
  }

  async revoke(deviceId: string): Promise<void> {
    const manager = this.tenantContext.getManager();
    const repository = manager.getRepository(DeviceEntity);
    const device = await repository.findOneBy({ id: deviceId });
    if (!device) {
      throw new NotFoundException(`device ${deviceId} not found`);
    }
    await repository.update({ id: deviceId }, { status: 'inactive' });
  }
}
