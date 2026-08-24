import { api } from '../../lib/api-client';

export interface Camera {
  id: string;
  tenantId: string;
  areaId: string;
  name: string;
  streamUrl: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterCameraInput {
  name: string;
  areaId: string;
  streamUrl: string;
}

export async function listCameras(): Promise<Camera[]> {
  return api.get('/v1/cameras');
}

export async function registerCamera(input: RegisterCameraInput): Promise<Camera> {
  return api.post('/v1/cameras', input);
}
