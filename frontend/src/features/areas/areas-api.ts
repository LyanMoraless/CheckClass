import { api } from '../../lib/api-client';

export interface Area {
  id: string;
  parentAreaId: string | null;
  name: string;
}

export interface AreaInput {
  name: string;
  parentAreaId?: string;
}

export async function listAreas(): Promise<Area[]> {
  return api.get('/v1/areas');
}

// Frente 08: create side of the institution's own área/bloco structure —
// POST /v1/areas is gated manage_institution_structure server-side
// (area.controller.ts), same permission this client already assumes for
// listAreas's callers. A row with parentAreaId set nests inside an existing
// one (bloco -> área/andar/corredor, create-area.dto.ts's own header
// comment); omitted, it becomes a new top-level bloco.
export async function createArea(input: AreaInput): Promise<Area> {
  return api.post('/v1/areas', input);
}
