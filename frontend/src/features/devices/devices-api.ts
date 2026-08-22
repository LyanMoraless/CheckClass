import { api } from '../../lib/api-client';

export interface Device {
  id: string;
  tenantId: string;
  roomId: string | null;
  deviceType: string;
  externalIdentifier: string;
  status: string;
  apiKeyId: string;
  apiKeyCreatedAt: string;
}

export interface RegisterDeviceInput {
  roomId?: string;
  deviceType: string;
  externalIdentifier: string;
}

export interface RegisteredDevice {
  deviceId: string;
  apiKey: string;
}

export async function listDevices(): Promise<Device[]> {
  return api.get('/v1/devices');
}

export async function registerDevice(input: RegisterDeviceInput): Promise<RegisteredDevice> {
  return api.post('/v1/devices', input);
}

export async function revokeDevice(deviceId: string): Promise<{ deviceId: string; status: string }> {
  return api.post(`/v1/devices/${deviceId}/revoke`);
}
