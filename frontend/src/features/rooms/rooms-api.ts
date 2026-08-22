import { api } from '../../lib/api-client';

export interface Room {
  id: string;
  name: string;
}

export interface CreateRoomInput {
  name: string;
}

export async function listRooms(): Promise<Room[]> {
  return api.get('/v1/rooms');
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  return api.post('/v1/rooms', input);
}
