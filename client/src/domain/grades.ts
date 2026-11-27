import { GRADE_POINTS, PASSING_GRADES } from './curriculum';
import type { Attempt, AttemptHistory } from './types';

export const isPassingAttempt = (attempt: Attempt): boolean =>
  attempt.grade === null || PASSING_GRADES.has(attempt.grade);

export const hasPassed = (attempts: readonly Attempt[] | undefined): boolean =>
  (attempts ?? []).some(isPassingAttempt);

export interface GpaResult {
  /** `null` cuando no hay ningún intento con nota: no hay índice que mostrar. */
  value: number | null;
  /** Créditos que entran al cálculo (suma de créditos de cada intento con nota). */
  gradedCredits: number;
}

/**
 * Índice ponderado por créditos.
 *
 * Política: cada intento con nota cuenta, incluidos D y F y los repetidos.
 * Si una materia de 4 créditos se reprueba con F y luego se aprueba con B,
 * entran 4 créditos con 0 puntos y 4 con 3. Los intentos sin nota
 * (aprobada sin calificación) no entran.
 */
export function computeGpa(
  history: AttemptHistory,
  creditsOf: (courseId: string) => number,
  filter: (attempt: Attempt) => boolean = () => true,
): GpaResult {
  let points = 0;
  let gradedCredits = 0;
  for (const [courseId, attempts] of Object.entries(history)) {
    const credits = creditsOf(courseId);
    for (const attempt of attempts) {
      if (attempt.grade === null || !filter(attempt)) continue;
      points += GRADE_POINTS[attempt.grade] * credits;
      gradedCredits += credits;
    }
  }
  return { value: gradedCredits > 0 ? points / gradedCredits : null, gradedCredits };
}

export interface PeriodGpa extends GpaResult {
  period: string;
}

/** Índice de cada cuatrimestre (sólo intentos con período y nota), en orden cronológico. */
export function gpaByPeriod(history: AttemptHistory, creditsOf: (courseId: string) => number): PeriodGpa[] {
  const periods = new Set<string>();
  for (const attempts of Object.values(history)) {
    for (const attempt of attempts) if (attempt.period && attempt.grade !== null) periods.add(attempt.period);
  }
  return [...periods]
    .sort()
    .map((period) => ({ period, ...computeGpa(history, creditsOf, (a) => a.period === period) }));
}

/**
 * Índice con dos decimales truncado: 2.499 no debe mostrarse como 2.50 cuando
 * el mínimo para Básicas es 2.5. El epsilon evita que 2.53 * 100 = 252.999…
 * se trunque a 2.52.
 */
export const formatGpa = (value: number | null): string =>
  value === null ? '—' : (Math.floor(value * 100 + 1e-9) / 100).toFixed(2);
