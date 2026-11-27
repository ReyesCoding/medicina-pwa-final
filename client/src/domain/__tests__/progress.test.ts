import { describe, expect, it } from 'vitest';
import { evaluateProgress } from '../progress';
import type { AttemptHistory, Course } from '../types';
import { course, graded, ungraded } from './fixtures';

/**
 * Mini pensum con la misma forma que el real: Premédica con una cadena de
 * prerrequisitos y 12 créditos de electivas generales; Básicas detrás de la
 * puerta (bloque completo + índice 2.5); una materia con requisito especial.
 */
const PENSUM: Course[] = [
  course('PRE-101', { credits: 4 }),
  course('PRE-102', { credits: 4, term: 2, prerequisites: ['PRE-101'] }),
  course('GEN-001', { credits: 6, term: null, elective: 'GENERAL' }),
  course('GEN-002', { credits: 6, term: null, elective: 'GENERAL' }),
  course('GEN-003', { credits: 4, term: null, elective: 'GENERAL' }),
  course('BAS-201', { block: 'BASICAS', term: 7 }),
  course('BAS-202', { block: 'BASICAS', term: 8, prerequisites: ['BAS-201'] }),
  course('ADM-900', { block: 'BASICAS', term: 9, requirement: { type: 'allMandatoryThroughTerm', term: 8 } }),
];

/** Premédica completa (obligatorias + 12 cr de electivas) con la misma nota en todo. */
const premedDone = (grade: 'A' | 'C' = 'A'): AttemptHistory => ({
  'PRE-101': [graded(grade)],
  'PRE-102': [graded(grade)],
  'GEN-001': [graded(grade)],
  'GEN-002': [graded(grade)],
});

const statusOf = (history: AttemptHistory, id: string) => evaluateProgress(PENSUM, history).courses.get(id)!;

describe('prerrequisitos', () => {
  it('bloquea y lista exactamente qué falta', () => {
    expect(statusOf({}, 'PRE-102')).toMatchObject({
      status: 'blocked',
      reasons: [{ kind: 'prerequisites', missing: ['PRE-101'] }],
    });
  });

  it('desbloquea al aprobar el prerrequisito', () => {
    expect(statusOf({ 'PRE-101': [graded('B')] }, 'PRE-102').status).toBe('available');
  });

  it('una D no desbloquea y la materia queda para repetir', () => {
    const progress = evaluateProgress(PENSUM, { 'PRE-101': [graded('D')] });
    expect(progress.courses.get('PRE-102')!.status).toBe('blocked');
    expect(progress.courses.get('PRE-101')).toMatchObject({ status: 'available', failedAttempts: 1 });
  });
});

describe('electivas generales', () => {
  it('no se pueden cursar en el primer cuatrimestre', () => {
    expect(statusOf({}, 'GEN-001')).toMatchObject({ status: 'blocked', reasons: [{ kind: 'firstTerm' }] });
  });

  it('se habilitan en cuanto hay un cuatrimestre cursado', () => {
    expect(statusOf({ 'PRE-101': [graded('F')] }, 'GEN-001').status).toBe('available');
  });
});

describe('puerta Premédica → Ciencias Básicas', () => {
  it('se abre con el bloque completo e índice ≥ 2.5', () => {
    const progress = evaluateProgress(PENSUM, premedDone('A'));
    expect(progress.blocks.PREMEDICA.complete).toBe(true);
    expect(progress.blocks.BASICAS.entry.open).toBe(true);
    expect(progress.courses.get('BAS-201')!.status).toBe('available');
  });

  it('exige los créditos de electivas además de las obligatorias', () => {
    const { 'GEN-002': _, ...history } = premedDone('A');
    const progress = evaluateProgress(PENSUM, history);
    expect(progress.blocks.PREMEDICA.elective).toEqual({ group: 'GENERAL', required: 12, earned: 6 });
    expect(progress.blocks.BASICAS.entry.gaps).toEqual([{ kind: 'blockIncomplete', block: 'PREMEDICA' }]);
    expect(progress.courses.get('BAS-201')).toMatchObject({
      status: 'blocked',
      reasons: [{ kind: 'blockLocked', block: 'BASICAS' }],
    });
  });

  it('bloquea con índice menor a 2.5 aunque el bloque esté completo', () => {
    const history = { ...premedDone('C'), 'GEN-003': [graded('F')] }; // 40 pts / 24 cr
    const progress = evaluateProgress(PENSUM, history);
    expect(progress.blocks.BASICAS.entry.open).toBe(false);
    expect(progress.blocks.BASICAS.entry.gaps).toEqual([
      { kind: 'gpaBelow', required: 2.5, current: expect.closeTo(40 / 24, 10) },
    ]);
  });

  it('no bloquea por índice si no hay ninguna nota, pero lo marca como sin verificar', () => {
    const history = Object.fromEntries(Object.keys(premedDone()).map((id) => [id, [ungraded()]]));
    const entry = evaluateProgress(PENSUM, history).blocks.BASICAS.entry;
    expect(entry).toMatchObject({ open: true, gpaUnverified: true, gaps: [] });
  });

  it('si ya cursó materias del bloque, una baja posterior del índice no le cierra el acceso', () => {
    const history = { ...premedDone('C'), 'BAS-201': [graded('F')] };
    const progress = evaluateProgress(PENSUM, history);
    expect(progress.blocks.BASICAS.entry).toMatchObject({ open: true, entered: true });
    expect(progress.courses.get('BAS-201')!.status).toBe('available');
  });
});

describe('requisito especial (ADM-900)', () => {
  it('exige todas las obligatorias hasta el cuatrimestre indicado', () => {
    const history = { ...premedDone('A'), 'BAS-201': [graded('A')] };
    expect(statusOf(history, 'ADM-900')).toMatchObject({
      status: 'blocked',
      reasons: [{ kind: 'allMandatoryThroughTerm', term: 8, missing: ['BAS-202'] }],
    });
    expect(statusOf({ ...history, 'BAS-202': [graded('A')] }, 'ADM-900').status).toBe('available');
  });
});

describe('materias en curso', () => {
  const enrolled = new Set(['PRE-101']);

  it('se marcan como cursando y no desbloquean nada por sí solas', () => {
    const progress = evaluateProgress(PENSUM, {}, { enrolled });
    expect(progress.courses.get('PRE-101')!.status).toBe('enrolled');
    expect(progress.courses.get('PRE-102')!.status).toBe('blocked');
  });

  it('cuentan como segundo cuatrimestre para las electivas generales', () => {
    expect(evaluateProgress(PENSUM, {}, { enrolled }).courses.get('GEN-001')!.status).toBe('available');
  });

  it('al planificar por adelantado se asumen aprobadas sin tocar el índice', () => {
    const progress = evaluateProgress(PENSUM, {}, { enrolled, assumeEnrolledPassed: true });
    expect(progress.courses.get('PRE-101')).toMatchObject({ status: 'passed', assumed: true });
    expect(progress.courses.get('PRE-102')!.status).toBe('available');
    expect(progress.gpa.value).toBeNull();
  });
});

describe('créditos para el título', () => {
  it('no cuenta electivas por encima del mínimo del bloque', () => {
    const history = { ...premedDone('A'), 'GEN-003': [graded('A')] }; // 16 cr de electivas, mínimo 12
    const progress = evaluateProgress(PENSUM, history);
    expect(progress.degreeCredits).toBe(4 + 4 + 12);
  });

  it('cuenta las aprobadas sin nota aparte, porque no entran al índice', () => {
    const progress = evaluateProgress(PENSUM, { 'PRE-101': [ungraded()], 'PRE-102': [graded('F'), ungraded()] });
    expect(progress.ungradedPassed).toBe(2);
  });
});
