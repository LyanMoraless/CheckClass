import { api } from '../../lib/api-client';

// Institutional calendar (RULE-INST-04 closure note in
// institution-management-rules.md): a holiday applies to the whole tenant,
// never to a single room/turma. Marking a date as a holiday after sessions
// were already generated for it auto-cancels those sessions server-side —
// this feature only needs to expose the CRUD, not that side effect.
export interface Holiday {
  id: string;
  tenantId: string;
  date: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHolidayInput {
  date: string;
  name: string;
}

export async function listHolidays(): Promise<Holiday[]> {
  return api.get('/v1/holidays');
}

export async function createHoliday(input: CreateHolidayInput): Promise<Holiday> {
  return api.post('/v1/holidays', input);
}

export async function deleteHoliday(id: string): Promise<void> {
  await api.delete(`/v1/holidays/${id}`);
}
