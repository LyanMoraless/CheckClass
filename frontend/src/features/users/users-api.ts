import { api } from '../../lib/api-client';

export interface CreatePersonInput {
  fullName: string;
  actorTypeCode: string;
  cpf?: string;
  password?: string;
}

export interface CreatedPerson {
  personId: string;
  actorTypeId: string;
}

export interface Person {
  personId: string;
  fullName: string;
  actorTypeCode: string;
  hasLoginCredential: boolean;
}

export async function createPerson(input: CreatePersonInput): Promise<CreatedPerson> {
  return api.post('/v1/users', input);
}

// Gated MANAGE_USERS server-side. Screens outside that permission (e.g.
// class-group enrollment, which only needs MANAGE_INSTITUTION_STRUCTURE)
// call this too, for convenience, and must tolerate it 403ing — see
// PersonIdField, which falls back to manual id entry when this fails.
export async function listPersons(): Promise<Person[]> {
  return api.get('/v1/users');
}
