import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';

interface ResolvedDevice {
  device_id: string;
  tenant_id: string;
  device_type: string;
  api_key_secret_hash: string;
  status: string;
}

export interface AuthenticatedDevice {
  deviceId: string;
  tenantId: string;
  deviceType: string;
}

// Fixed placeholder to hash the presented secret against when apiKeyId
// doesn't resolve to any device — security review finding: short-circuiting
// before that hash/compare work made "unknown apiKeyId" measurably faster
// than "known apiKeyId, wrong secret", a timing side-channel an attacker
// could use to enumerate valid device ids over the network.
const DUMMY_SECRET_HASH = createHash('sha256').update('checkclass-dummy-comparison-target').digest('hex');

// Runs BEFORE any tenant context exists — deliberately bypasses the app
// role's normal RLS scoping via the resolve_device_by_api_key_id() function
// (SECURITY DEFINER, see AddDeviceApiKey migration), which is the one
// sanctioned way to look a device up across tenants.
@Injectable()
export class DeviceAuthService {
  constructor(private readonly dataSource: DataSource) {}

  async authenticate(rawKey: string): Promise<AuthenticatedDevice> {
    const [apiKeyId, secret] = this.parseKey(rawKey);

    const rows: ResolvedDevice[] = await this.dataSource.query(
      'SELECT * FROM resolve_device_by_api_key_id($1)',
      [apiKeyId],
    );
    const device = rows[0];
    const secretIsValid = this.secretMatches(secret, device?.api_key_secret_hash ?? DUMMY_SECRET_HASH);
    if (!device || !secretIsValid) {
      throw new UnauthorizedException('Invalid device credentials');
    }
    if (device.status !== 'active') {
      throw new ForbiddenException('Device is not active');
    }

    return { deviceId: device.device_id, tenantId: device.tenant_id, deviceType: device.device_type };
  }

  private parseKey(rawKey: string): [string, string] {
    const separatorIndex = rawKey.indexOf('.');
    if (separatorIndex <= 0 || separatorIndex === rawKey.length - 1) {
      throw new UnauthorizedException('Invalid device credentials');
    }
    return [rawKey.slice(0, separatorIndex), rawKey.slice(separatorIndex + 1)];
  }

  private secretMatches(presentedSecret: string, storedHash: string): boolean {
    const presentedHash = createHash('sha256').update(presentedSecret).digest('hex');
    const presentedBuffer = Buffer.from(presentedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    return presentedBuffer.length === storedBuffer.length && timingSafeEqual(presentedBuffer, storedBuffer);
  }
}
