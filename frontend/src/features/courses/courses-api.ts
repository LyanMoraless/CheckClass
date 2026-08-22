import { api } from '../../lib/api-client';

export interface Course {
  id: string;
  name: string;
  code: string | null;
}

export interface CreateCourseInput {
  name: string;
  code?: string;
}

export async function listCourses(): Promise<Course[]> {
  return api.get('/v1/courses');
}

export async function createCourse(input: CreateCourseInput): Promise<Course> {
  return api.post('/v1/courses', input);
}
