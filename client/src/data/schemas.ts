import { z } from 'zod';
import { BLOCK_IDS, ELECTIVE_GROUPS, LETTER_GRADES } from '@/domain/types';

/**
 * Esquemas de validación en los bordes: lo que llega por red (datasets) o
 * desde el almacenamiento/archivos del usuario (respaldo) se valida acá y el
 * resto del código puede confiar en los tipos.
 */

const courseId = z.string().regex(/^[A-Z]{3}-\d{3}$/, 'Clave con formato AAA-000');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora HH:MM');

export const courseSchema = z.object({
  id: courseId,
  name: z.string().min(1),
  credits: z.number().int().positive(),
  theoreticalHours: z.number().int().nonnegative(),
  practicalHours: z.number().int().nonnegative(),
  weeks: z.number().int().positive().optional(),
  term: z.number().int().min(1).max(18).nullable(),
  block: z.enum(BLOCK_IDS),
  elective: z.enum(ELECTIVE_GROUPS).nullable(),
  prerequisites: z.array(courseId),
  corequisites: z.array(courseId),
  requirement: z.object({ type: z.literal('allMandatoryThroughTerm'), term: z.number().int() }).optional(),
});

export const sectionSchema = z.object({
  crn: z.string().min(1),
  courseId,
  room: z.string(),
  modality: z.enum(['presencial', 'virtual', 'hospital']),
  meetings: z.array(
    z
      .object({
        day: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6)]),
        start: hhmm,
        end: hhmm,
      })
      .refine((m) => m.start < m.end, 'La clase debe terminar después de empezar'),
  ),
});

export const coursesFileSchema = z.array(courseSchema);
export const sectionsFileSchema = z.array(sectionSchema);

export const periodSchema = z.string().regex(/^\d{4}-[123]$/);

export const attemptSchema = z.object({
  grade: z.enum(LETTER_GRADES).nullable(),
  period: periodSchema.nullable(),
});

export const planItemSchema = z.object({ courseId, crn: z.string().nullable() });
