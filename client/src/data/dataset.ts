import type { Course, Section } from '@/domain/types';
import { coursesFileSchema, sectionsFileSchema } from './schemas';

export interface Dataset {
  courses: Course[];
  coursesById: ReadonlyMap<string, Course>;
  sectionsByCourse: ReadonlyMap<string, readonly Section[]>;
}

/**
 * Descarga y valida los datos estáticos. Si el JSON publicado no cumple el
 * esquema se falla con un error claro en lugar de renderizar con datos rotos.
 */
export async function loadDataset(baseUrl: string = import.meta.env.BASE_URL): Promise<Dataset> {
  const [coursesJson, sectionsJson] = await Promise.all([
    fetchJson(`${baseUrl}data/courses.json`),
    fetchJson(`${baseUrl}data/sections.json`),
  ]);
  const courses = coursesFileSchema.parse(coursesJson);
  const sections = sectionsFileSchema.parse(sectionsJson);

  const sectionsByCourse = new Map<string, Section[]>();
  for (const section of sections) {
    const list = sectionsByCourse.get(section.courseId);
    if (list) list.push(section);
    else sectionsByCourse.set(section.courseId, [section]);
  }

  return { courses, coursesById: new Map(courses.map((c) => [c.id, c])), sectionsByCourse };
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`No se pudo descargar ${url} (HTTP ${response.status})`);
  return response.json();
}
