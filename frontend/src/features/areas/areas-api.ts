import { api } from '../../lib/api-client';

export interface Area {
  id: string;
  parentAreaId: string | null;
  name: string;
}

export async function listAreas(): Promise<Area[]> {
  return api.get('/v1/areas');
}
