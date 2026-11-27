/**
 * Modelo de dominio del planificador. Estos tipos describen el pensum (datos
 * estáticos) y el historial del estudiante (datos propios); toda la lógica de
 * reglas vive en funciones puras sobre ellos, sin React ni almacenamiento.
 */

export const BLOCK_IDS = ['PREMEDICA', 'BASICAS', 'CLINICAS', 'INTERNADO', 'PROYECTO_GRADO'] as const;
export type BlockId = (typeof BLOCK_IDS)[number];

export const ELECTIVE_GROUPS = ['GENERAL', 'BASICAS', 'CLINICAS'] as const;
export type ElectiveGroup = (typeof ELECTIVE_GROUPS)[number];

/** Requisitos que el PDF expresa en prosa y no como lista de claves. */
export type SpecialRequirement = { type: 'allMandatoryThroughTerm'; term: number };

export interface Course {
  id: string;
  name: string;
  credits: number;
  theoreticalHours: number;
  practicalHours: number;
  /** Sólo internado rotatorio: duración en semanas. */
  weeks?: number;
  /** Cuatrimestre sugerido por el pensum; `null` en las electivas, que no tienen uno fijo. */
  term: number | null;
  block: BlockId;
  elective: ElectiveGroup | null;
  prerequisites: string[];
  corequisites: string[];
  requirement?: SpecialRequirement;
}

/** 1 = lunes … 6 = sábado. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6;

export interface Meeting {
  day: Weekday;
  /** "HH:MM", 24 h. */
  start: string;
  end: string;
}

export type Modality = 'presencial' | 'virtual' | 'hospital';

export interface Section {
  crn: string;
  courseId: string;
  room: string;
  modality: Modality;
  /** Vacío cuando la sección no tiene horario fijo (virtual asincrónica u hospital). */
  meetings: Meeting[];
}

export const LETTER_GRADES = ['A', 'B', 'C', 'D', 'F'] as const;
export type LetterGrade = (typeof LETTER_GRADES)[number];

export interface Attempt {
  /**
   * `null` = aprobada sin calificación registrada. Sirve para cargar rápido el
   * historial: cuenta para créditos y requisitos, pero no entra al índice.
   */
  grade: LetterGrade | null;
  /** Cuatrimestre en formato "AAAA-N" (N: 1 ene–abr, 2 may–ago, 3 sep–dic). */
  period: string | null;
}

/** Historial por materia. Una materia puede tener varios intentos (reprobada y repetida). */
export type AttemptHistory = Record<string, Attempt[]>;

export interface PlanItem {
  courseId: string;
  /** Sección elegida; `null` si todavía no eligió o la materia no tiene oferta cargada. */
  crn: string | null;
}
