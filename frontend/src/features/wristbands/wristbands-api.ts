import { api, buildQuery } from '../../lib/api-client';

export interface WristbandCategory {
  id: string;
  name: string;
}

export interface Wristband {
  id: string;
  personId: string;
  wristbandCategoryId: string;
  tagCode: string;
  status: string;
}

export async function listWristbandCategories(): Promise<WristbandCategory[]> {
  return api.get('/v1/wristbands/categories');
}

export async function createWristbandCategory(name: string): Promise<WristbandCategory> {
  return api.post('/v1/wristbands/categories', { name });
}

export async function listWristbandsByPerson(personId: string): Promise<Wristband[]> {
  return api.get(`/v1/wristbands${buildQuery({ personId })}`);
}

export async function issueWristband(input: {
  personId: string;
  wristbandCategoryId: string;
  tagCode: string;
}): Promise<Wristband> {
  return api.post('/v1/wristbands', input);
}

export async function revokeWristband(wristbandId: string): Promise<{ wristbandId: string; status: string }> {
  return api.post(`/v1/wristbands/${wristbandId}/revoke`);
}
