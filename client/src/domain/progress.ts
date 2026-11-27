import { BLOCK_ORDER, BLOCKS, PENSUM } from './curriculum';
import { computeGpa, hasPassed, isPassingAttempt, type GpaResult } from './grades';
import type { Attempt, AttemptHistory, BlockId, Course, ElectiveGroup } from './types';

/** Por qué una materia todavía no se puede cursar. Un curso puede tener varias. */
export type BlockReason =
  | { kind: 'blockLocked'; block: BlockId }
  | { kind: 'firstTerm' }
  | { kind: 'prerequisites'; missing: string[] }
  | { kind: 'allMandatoryThroughTerm'; term: number; missing: string[] };

/** `enrolled`: la está cursando ahora (todavía sin nota). */
export type CourseStatus = 'passed' | 'enrolled' | 'available' | 'blocked';

export interface CourseState {
  status: CourseStatus;
  reasons: BlockReason[];
  attempts: Attempt[];
  failedAttempts: number;
  /** Aprobada sólo por suposición (materia en curso) al planificar el siguiente cuatrimestre. */
  assumed: boolean;
}

export type EntryGap =
  | { kind: 'blockIncomplete'; block: BlockId }
  | { kind: 'gpaBelow'; required: number; current: number };

export interface BlockStatus {
  id: BlockId;
  mandatoryCredits: number;
  passedMandatoryCredits: number;
  missingMandatory: string[];
  elective: { group: ElectiveGroup; required: number; earned: number } | null;
  /** Obligatorias aprobadas y electivas del bloque cumplidas. */
  complete: boolean;
  entry: {
    open: boolean;
    /** Condiciones de entrada que no se cumplen (informativas si el bloque ya se abrió). */
    gaps: EntryGap[];
    /** Ya hay intentos registrados en el bloque: el estudiante entró, aunque hoy no cumpla la puerta. */
    entered: boolean;
    /** Exige índice mínimo pero no hay notas para calcularlo; no se bloquea por eso. */
    gpaUnverified: boolean;
  };
}

export interface ProgressSnapshot {
  courses: Map<string, CourseState>;
  blocks: Record<BlockId, BlockStatus>;
  gpa: GpaResult;
  /** Créditos válidos para el título: electivas topadas al mínimo exigido por bloque. */
  degreeCredits: number;
  totalCredits: number;
  /** Materias aprobadas sin calificación: no cuentan para el índice. */
  ungradedPassed: number;
}

export interface EvaluateOptions {
  /** Materias que el estudiante está cursando este cuatrimestre. */
  enrolled?: ReadonlySet<string>;
  /**
   * Tratar las materias en curso como aprobadas. Sirve para planificar el
   * cuatrimestre siguiente antes de tener las notas del actual.
   */
  assumeEnrolledPassed?: boolean;
}

/**
 * Calcula el estado académico completo a partir del pensum y del historial.
 *
 * Orden de evaluación: (1) qué está aprobado, (2) índice, (3) completitud de
 * cada bloque, (4) puertas de entrada entre bloques, (5) estado de cada
 * materia con todas las razones de bloqueo, para que la UI pueda explicar
 * "por qué no puedo inscribir esto" en vez de sólo decir "bloqueada".
 */
export function evaluateProgress(
  courses: readonly Course[],
  history: AttemptHistory,
  options: EvaluateOptions = {},
): ProgressSnapshot {
  const enrolled = options.enrolled ?? new Set<string>();
  const assumePassed = options.assumeEnrolledPassed ? enrolled : new Set<string>();
  const byId = new Map(courses.map((course) => [course.id, course]));
  const creditsOf = (id: string) => byId.get(id)?.credits ?? 0;

  const passedForReal = new Set(courses.filter((c) => hasPassed(history[c.id])).map((c) => c.id));
  const isPassed = (id: string) => passedForReal.has(id) || assumePassed.has(id);

  // El índice usa sólo notas reales: una suposición nunca debe mejorarlo.
  const gpa = computeGpa(history, creditsOf);

  const blocks = {} as Record<BlockId, BlockStatus>;
  for (const blockId of BLOCK_ORDER) {
    const rule = BLOCKS[blockId];
    const inBlock = courses.filter((c) => c.block === blockId);
    const mandatory = inBlock.filter((c) => c.elective === null);
    const missingMandatory = mandatory.filter((c) => !isPassed(c.id)).map((c) => c.id);
    const elective = rule.electives
      ? {
          group: rule.electives.group,
          required: rule.electives.credits,
          earned: inBlock
            .filter((c) => c.elective === rule.electives!.group && isPassed(c.id))
            .reduce((sum, c) => sum + c.credits, 0),
        }
      : null;

    blocks[blockId] = {
      id: blockId,
      mandatoryCredits: mandatory.reduce((sum, c) => sum + c.credits, 0),
      passedMandatoryCredits: mandatory.filter((c) => isPassed(c.id)).reduce((sum, c) => sum + c.credits, 0),
      missingMandatory,
      elective,
      complete: missingMandatory.length === 0 && (elective === null || elective.earned >= elective.required),
      entry: {
        open: true,
        gaps: [],
        entered: inBlock.some((c) => (history[c.id]?.length ?? 0) > 0 || enrolled.has(c.id)),
        gpaUnverified: false,
      },
    };
  }

  // Las puertas dependen de la completitud ya calculada del bloque anterior.
  for (const blockId of BLOCK_ORDER) {
    const rule = BLOCKS[blockId];
    const entry = blocks[blockId].entry;
    if (rule.requiresBlock && !blocks[rule.requiresBlock].complete) {
      entry.gaps.push({ kind: 'blockIncomplete', block: rule.requiresBlock });
    }
    if (rule.minGpa !== null) {
      if (gpa.value === null) entry.gpaUnverified = true;
      else if (gpa.value < rule.minGpa) entry.gaps.push({ kind: 'gpaBelow', required: rule.minGpa, current: gpa.value });
    }
    // La puerta se evalúa al entrar. Si ya cursó materias del bloque, una baja
    // posterior del índice no le quita acceso a lo que le queda del bloque.
    entry.open = entry.gaps.length === 0 || entry.entered;
  }

  // Si ya tiene notas o está cursando, el próximo cuatrimestre es como mínimo el segundo.
  const hasCompletedATerm = Object.values(history).some((attempts) => attempts.length > 0) || enrolled.size > 0;

  const states = new Map<string, CourseState>();
  for (const course of courses) {
    const attempts = history[course.id] ?? [];
    const failedAttempts = attempts.filter((a) => !isPassingAttempt(a)).length;
    if (isPassed(course.id)) {
      states.set(course.id, {
        status: 'passed',
        reasons: [],
        attempts,
        failedAttempts,
        assumed: !passedForReal.has(course.id),
      });
      continue;
    }
    if (enrolled.has(course.id)) {
      states.set(course.id, { status: 'enrolled', reasons: [], attempts, failedAttempts, assumed: false });
      continue;
    }

    const reasons: BlockReason[] = [];
    if (!blocks[course.block].entry.open) reasons.push({ kind: 'blockLocked', block: course.block });
    if (course.elective && BLOCKS[course.block].electives?.notInFirstTerm && !hasCompletedATerm) {
      reasons.push({ kind: 'firstTerm' });
    }
    const missingPrereqs = course.prerequisites.filter((id) => !isPassed(id));
    if (missingPrereqs.length > 0) reasons.push({ kind: 'prerequisites', missing: missingPrereqs });
    if (course.requirement?.type === 'allMandatoryThroughTerm') {
      const { term } = course.requirement;
      const missing = courses
        .filter((c) => c.elective === null && c.term !== null && c.term <= term && !isPassed(c.id))
        .map((c) => c.id);
      if (missing.length > 0) reasons.push({ kind: 'allMandatoryThroughTerm', term, missing });
    }

    states.set(course.id, {
      status: reasons.length > 0 ? 'blocked' : 'available',
      reasons,
      attempts,
      failedAttempts,
      assumed: false,
    });
  }

  const degreeCredits = BLOCK_ORDER.reduce((sum, id) => {
    const block = blocks[id];
    const electiveCredits = block.elective ? Math.min(block.elective.earned, block.elective.required) : 0;
    return sum + block.passedMandatoryCredits + electiveCredits;
  }, 0);

  const ungradedPassed = Object.values(history).filter(
    (attempts) => attempts.some((a) => a.grade === null) && !attempts.some((a) => a.grade !== null && isPassingAttempt(a)),
  ).length;

  return {
    courses: states,
    blocks,
    gpa,
    degreeCredits,
    totalCredits: PENSUM.totalCredits,
    ungradedPassed,
  };
}
