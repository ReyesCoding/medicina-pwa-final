import type { BlockId, ElectiveGroup, LetterGrade } from './types';

/**
 * Reglas del Pensum de Medicina UTESA 2013 (Resolución Of. SG. No. 129/12),
 * transcritas del documento oficial. Están separadas de los datos de materias
 * porque son reglas de negocio: cambiarlas debe pasar por los tests.
 */
export const PENSUM = {
  title: 'Pensum de Medicina',
  university: 'UTESA',
  validFrom: 'Enero 2013',
  resolution: 'Of. SG. No. 129/12',
  totalCredits: 451,
} as const;

export interface BlockRule {
  label: string;
  /** Requisito de entrada: bloque anterior aprobado completo (obligatorias + electivas). */
  requiresBlock: BlockId | null;
  /** Índice acumulado mínimo para entrar (sólo Ciencias Básicas lo exige). */
  minGpa: number | null;
  /**
   * Créditos de electivas a aprobar "durante el transcurso del bloque". Se
   * pueden cursar en cuanto el bloque está abierto; las generales, además,
   * sólo "a partir del segundo cuatrimestre" (`notInFirstTerm`).
   */
  electives: { group: ElectiveGroup; credits: number; notInFirstTerm?: boolean } | null;
}

export const BLOCK_ORDER: readonly BlockId[] = ['PREMEDICA', 'BASICAS', 'CLINICAS', 'INTERNADO', 'PROYECTO_GRADO'];

export const BLOCKS: Record<BlockId, BlockRule> = {
  PREMEDICA: {
    label: 'Premédica',
    requiresBlock: null,
    minGpa: null,
    electives: { group: 'GENERAL', credits: 12, notInFirstTerm: true },
  },
  BASICAS: {
    label: 'Ciencias Básicas',
    requiresBlock: 'PREMEDICA',
    minGpa: 2.5,
    electives: { group: 'BASICAS', credits: 8 },
  },
  CLINICAS: {
    label: 'Ciencias Clínicas y Quirúrgicas',
    requiresBlock: 'BASICAS',
    minGpa: null,
    electives: { group: 'CLINICAS', credits: 8 },
  },
  INTERNADO: {
    label: 'Internado Rotatorio',
    requiresBlock: 'CLINICAS',
    minGpa: null,
    electives: null,
  },
  // El PDF no le asigna requisito de bloque al proyecto de grado; su única
  // condición es DPG-010 (que a su vez exige ADM-900 y todo hasta el 13º).
  PROYECTO_GRADO: {
    label: 'Proyecto de Grado',
    requiresBlock: null,
    minGpa: null,
    electives: null,
  },
};

export const ELECTIVE_LABELS: Record<ElectiveGroup, string> = {
  GENERAL: 'Electivas generales',
  BASICAS: 'Electivas profesionalizantes · Básicas',
  CLINICAS: 'Electivas profesionalizantes · Clínicas',
};

export const GRADE_POINTS: Record<LetterGrade, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };

/** En UTESA la D no aprueba: sólo A, B y C. D y F igual cuentan en el índice. */
export const PASSING_GRADES: ReadonlySet<LetterGrade> = new Set(['A', 'B', 'C']);

/** Carga del cuatrimestre más pesado del pensum (12º). El estudiante puede cambiarla. */
export const DEFAULT_CREDIT_CAP = 31;
