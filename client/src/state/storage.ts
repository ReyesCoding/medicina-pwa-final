import { z } from 'zod';
import { attemptSchema, periodSchema, planItemSchema } from '@/data/schemas';
import { DEFAULT_CREDIT_CAP } from '@/domain/curriculum';
import { LETTER_GRADES, type AttemptHistory, type LetterGrade, type PlanItem } from '@/domain/types';

/**
 * Persistencia del estudiante en localStorage.
 *
 * GitHub Pages pone todos los proyectos de un usuario bajo el mismo origen
 * (reyescoding.github.io), y localStorage es por origen. Por eso todas las
 * claves llevan el prefijo de la app y nunca se usa localStorage.clear():
 * borraría datos del portafolio y de otros proyectos.
 */
export const STORAGE_KEY = 'medicina-pwa:student:v2';
export const RECOVERY_KEY = 'medicina-pwa:student:recovered';

/** Claves de la versión anterior de la app, sólo para migrar y limpiar. */
export const LEGACY_KEYS = {
  progress: 'medicina-student-progress',
  planner: 'medicina-planner-save',
  schedule: 'medicina-course-plan',
  adminCourses: 'admin:courses',
  adminSections: 'admin:sections',
  adminFlag: 'admin',
} as const;

export interface StudentData {
  history: AttemptHistory;
  /** Lo que está cursando ahora; se cierra registrando las notas. */
  current: { period: string | null; items: PlanItem[] };
  /** Lo que planifica para el próximo cuatrimestre. */
  plan: { items: PlanItem[]; creditCap: number; assumeCurrentPassed: boolean };
}

export const studentDataSchema = z.object({
  history: z.record(z.array(attemptSchema)),
  current: z.object({ period: periodSchema.nullable(), items: z.array(planItemSchema) }),
  plan: z.object({
    items: z.array(planItemSchema),
    creditCap: z.number().int().min(1).max(60),
    assumeCurrentPassed: z.boolean(),
  }),
});

const envelopeSchema = z.object({ version: z.literal(2), data: studentDataSchema });

export const emptyStudentData = (): StudentData => ({
  history: {},
  current: { period: null, items: [] },
  plan: { items: [], creditCap: DEFAULT_CREDIT_CAP, assumeCurrentPassed: true },
});

/** Subconjunto de la API de Storage que se usa; permite tests sin navegador. */
export type KeyValueStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export type LoadNotice = 'migrated' | 'recovered' | null;

export function loadStudentData(store: KeyValueStore): { data: StudentData; notice: LoadNotice } {
  const raw = store.getItem(STORAGE_KEY);
  if (raw !== null) {
    const parsed = envelopeSchema.safeParse(safeJson(raw));
    if (parsed.success) return { data: parsed.data.data, notice: null };
    // Datos ilegibles: no se descartan en silencio. Quedan apartados para
    // poder recuperarlos a mano y la UI avisa.
    trySet(store, RECOVERY_KEY, raw);
    return { data: emptyStudentData(), notice: 'recovered' };
  }

  const migrated = migrateLegacy(store);
  if (migrated) {
    if (saveStudentData(store, migrated)) Object.values(LEGACY_KEYS).forEach((key) => store.removeItem(key));
    return { data: migrated, notice: 'migrated' };
  }
  return { data: emptyStudentData(), notice: null };
}

/** Devuelve `false` si el navegador rechazó la escritura (cuota llena, modo privado de Safari). */
export function saveStudentData(store: KeyValueStore, data: StudentData): boolean {
  return trySet(store, STORAGE_KEY, JSON.stringify({ version: 2, data }));
}

/** Borra sólo los datos de esta app. */
export function clearStudentData(store: KeyValueStore): void {
  [STORAGE_KEY, RECOVERY_KEY, ...Object.values(LEGACY_KEYS)].forEach((key) => store.removeItem(key));
}

const BACKUP_APP_ID = 'medicina-pwa';

export function serializeBackup(data: StudentData, now: Date = new Date()): string {
  return JSON.stringify({ app: BACKUP_APP_ID, version: 2, exportedAt: now.toISOString(), data }, null, 2);
}

const backupSchema = z.object({ app: z.literal(BACKUP_APP_ID), version: z.literal(2), data: studentDataSchema });

/** Valida un respaldo importado; los mensajes de error están pensados para el estudiante. */
export function parseBackup(text: string): StudentData {
  const json = safeJson(text);
  if (json === undefined) throw new Error('El archivo no es un JSON válido.');
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    throw new Error('El archivo no es un respaldo de esta app o está dañado. No se cambió nada.');
  }
  return parsed.data.data;
}

/**
 * Migra el formato de la versión anterior:
 * - medicina-student-progress: { [id]: { status: 'passed', grade? } }
 * - medicina-planner-save: [{ courseId, sectionCrn }]
 * La fecha en que se marcaba una materia no era el cuatrimestre real, así que
 * los intentos migrados quedan sin período.
 */
export function migrateLegacy(store: KeyValueStore): StudentData | null {
  const progress = safeJson(store.getItem(LEGACY_KEYS.progress));
  const planner = safeJson(store.getItem(LEGACY_KEYS.planner));
  if (progress === undefined && planner === undefined) return null;

  const data = emptyStudentData();
  const isCourseId = (id: unknown): id is string => typeof id === 'string' && /^[A-Z]{3}-\d{3}$/.test(id);

  if (progress && typeof progress === 'object') {
    for (const [courseId, entry] of Object.entries(progress as Record<string, { status?: string; grade?: string }>)) {
      if (!isCourseId(courseId) || !entry) continue;
      if (entry.status === 'passed') {
        const grade = LETTER_GRADES.includes(entry.grade as LetterGrade) ? (entry.grade as LetterGrade) : null;
        data.history[courseId] = [{ grade, period: null }];
      } else if (entry.status === 'in_progress') {
        data.current.items.push({ courseId, crn: null });
      }
    }
  }

  if (Array.isArray(planner)) {
    for (const entry of planner as Array<{ courseId?: unknown; sectionCrn?: unknown }>) {
      if (!isCourseId(entry?.courseId) || data.plan.items.some((item) => item.courseId === entry.courseId)) continue;
      data.plan.items.push({ courseId: entry.courseId, crn: typeof entry.sectionCrn === 'string' ? entry.sectionCrn : null });
    }
  }
  return data;
}

function safeJson(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function trySet(store: KeyValueStore, key: string, value: string): boolean {
  try {
    store.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}
