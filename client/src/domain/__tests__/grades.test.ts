import { describe, expect, it } from 'vitest';
import { computeGpa, formatGpa, gpaByPeriod, hasPassed } from '../grades';
import { graded, ungraded } from './fixtures';

const credits: Record<string, number> = { BIG: 10, SMALL: 1, X: 4, Y: 4 };
const creditsOf = (id: string) => credits[id];

describe('hasPassed', () => {
  it('aprueba con A, B o C y también sin nota registrada', () => {
    expect(hasPassed([graded('C')])).toBe(true);
    expect(hasPassed([ungraded()])).toBe(true);
  });

  it('no aprueba con D ni con F', () => {
    expect(hasPassed([graded('D')])).toBe(false);
    expect(hasPassed([graded('F')])).toBe(false);
    expect(hasPassed(undefined)).toBe(false);
  });

  it('aprueba si cualquier intento aprobó', () => {
    expect(hasPassed([graded('F'), graded('B')])).toBe(true);
  });
});

describe('computeGpa', () => {
  it('pondera por créditos (regresión: antes promediaba sin ponderar y mostraba 3.00)', () => {
    const gpa = computeGpa({ BIG: [graded('A')], SMALL: [graded('C')] }, creditsOf);
    expect(gpa.value).toBeCloseTo((4 * 10 + 2 * 1) / 11, 10);
    expect(gpa.gradedCredits).toBe(11);
  });

  it('cuenta D, F y todos los intentos repetidos', () => {
    // X: F y luego B → 4 cr × 0 + 4 cr × 3; Y: D → 4 cr × 1
    const gpa = computeGpa({ X: [graded('F'), graded('B')], Y: [graded('D')] }, creditsOf);
    expect(gpa.value).toBeCloseTo((0 + 12 + 4) / 12, 10);
  });

  it('ignora intentos sin nota y devuelve null si no hay ninguna nota', () => {
    expect(computeGpa({ X: [ungraded()] }, creditsOf)).toEqual({ value: null, gradedCredits: 0 });
  });
});

describe('gpaByPeriod', () => {
  it('calcula el índice de cada cuatrimestre en orden cronológico', () => {
    const history = { X: [graded('F', '2025-1'), graded('A', '2025-2')], Y: [graded('B', '2025-1')] };
    expect(gpaByPeriod(history, creditsOf)).toEqual([
      { period: '2025-1', value: 1.5, gradedCredits: 8 },
      { period: '2025-2', value: 4, gradedCredits: 4 },
    ]);
  });
});

describe('formatGpa', () => {
  it('trunca en vez de redondear para no mostrar 2.50 a quien tiene 2.499', () => {
    expect(formatGpa(2.499)).toBe('2.49');
    expect(formatGpa(2.53)).toBe('2.53');
    expect(formatGpa(4)).toBe('4.00');
    expect(formatGpa(null)).toBe('—');
  });
});
