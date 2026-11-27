import { describe, expect, it } from 'vitest';
import {
  addToPlan,
  chooseSection,
  corequisiteGroup,
  criticalPathLengths,
  removeFromPlan,
  suggestPlan,
  validatePlan,
  type PlanContext,
} from '../planner';
import { evaluateProgress } from '../progress';
import type { AttemptHistory, Course, Section } from '../types';
import { course, graded, section } from './fixtures';

const COURSES: Course[] = [
  course('BIO-100', { credits: 3, corequisites: ['BIO-010'] }),
  course('BIO-010', { credits: 1, corequisites: ['BIO-100'] }),
  course('MAT-095', { credits: 4 }),
  course('MAT-100', { credits: 4, term: 2, prerequisites: ['MAT-095'] }),
  course('MAT-110', { credits: 4, term: 3, prerequisites: ['MAT-100'] }),
  course('ESP-095', { credits: 4 }),
  course('ORI-112', { credits: 2 }),
  course('QUI-750', { credits: 3, term: 3, prerequisites: ['MAT-100'], corequisites: ['QUI-755'] }),
  course('QUI-755', { credits: 1, term: 3, prerequisites: ['MAT-100'], corequisites: ['QUI-750'] }),
  course('GEN-001', { credits: 4, term: null, elective: 'GENERAL' }),
  course('GEN-002', { credits: 4, term: null, elective: 'GENERAL' }),
];

const SECTIONS: Section[] = [
  section('BIO-100', 'BIO1001', [1, '08:00', '10:15']),
  section('BIO-100', 'BIO1002', [2, '08:00', '10:15']),
  section('BIO-010', 'BIO0101', [1, '09:00', '10:30']), // choca con BIO1001
  section('BIO-010', 'BIO0102', [3, '09:00', '10:30']),
  section('MAT-095', 'MAT0951', [1, '08:00', '11:00']),
  section('MAT-095', 'MAT0952', [4, '08:00', '11:00']),
  section('ESP-095', 'ESP0951', [4, '08:00', '11:00']), // única: choca con MAT0952
  // ORI-112 sin oferta cargada
];

function context(history: AttemptHistory = {}, enrolled?: Set<string>): PlanContext {
  const sectionsByCourse = new Map<string, Section[]>();
  for (const s of SECTIONS) sectionsByCourse.set(s.courseId, [...(sectionsByCourse.get(s.courseId) ?? []), s]);
  return {
    coursesById: new Map(COURSES.map((c) => [c.id, c])),
    sectionsByCourse,
    snapshot: evaluateProgress(COURSES, history, { enrolled, assumeEnrolledPassed: true }),
  };
}

describe('correquisitos', () => {
  it('agregar la teoría agrega el laboratorio', () => {
    const result = addToPlan([], 'BIO-100', context());
    expect(result).toMatchObject({ ok: true, added: ['BIO-100', 'BIO-010'] });
  });

  it('si el laboratorio ya está aprobado, la teoría va sola (caso de quien reprobó sólo la teoría)', () => {
    const ctx = context({ 'BIO-010': [graded('B')], 'BIO-100': [graded('F')] });
    expect(corequisiteGroup('BIO-100', ctx)).toEqual(['BIO-100']);
    expect(validatePlan([{ courseId: 'BIO-100', crn: 'BIO1001' }], 31, ctx)).toEqual([]);
  });

  it('no agrega nada si un correquisito no se puede cursar', () => {
    const ctx = context();
    expect(addToPlan([], 'QUI-750', ctx)).toEqual({ ok: false, reason: 'notAvailable', courseId: 'QUI-750' });
  });

  it('quitar una del par quita las dos', () => {
    const ctx = context();
    const added = addToPlan([{ courseId: 'MAT-095', crn: null }], 'BIO-100', ctx);
    if (!added.ok) throw new Error('debía poder agregarse');
    expect(removeFromPlan(added.items, 'BIO-010', ctx)).toEqual({
      items: [{ courseId: 'MAT-095', crn: null }],
      removed: ['BIO-100', 'BIO-010'],
    });
  });

  it('valida el par incompleto si el plan quedó así por fuera del flujo normal', () => {
    const issues = validatePlan([{ courseId: 'BIO-100', crn: 'BIO1002' }], 31, context());
    expect(issues).toContainEqual({ kind: 'missingCorequisite', courseId: 'BIO-100', corequisiteId: 'BIO-010' });
  });
});

describe('validatePlan', () => {
  it('detecta choques con el tramo exacto', () => {
    const items = [
      { courseId: 'BIO-100', crn: 'BIO1001' },
      { courseId: 'BIO-010', crn: 'BIO0101' },
    ];
    expect(validatePlan(items, 31, context())).toEqual([
      {
        kind: 'scheduleConflict',
        conflict: { courseA: 'BIO-100', courseB: 'BIO-010', day: 1, start: '09:00', end: '10:15' },
      },
    ]);
  });

  it('avisa del tope de créditos, de secciones sin elegir y de secciones que ya no existen', () => {
    const items = [
      { courseId: 'MAT-095', crn: null },
      { courseId: 'ESP-095', crn: 'VIEJA' },
    ];
    expect(validatePlan(items, 6, context())).toEqual([
      { kind: 'sectionPending', courseId: 'MAT-095' },
      { kind: 'unknownSection', courseId: 'ESP-095', crn: 'VIEJA' },
      { kind: 'overCreditCap', credits: 8, cap: 6 },
    ]);
  });

  it('marca materias que dejaron de estar disponibles (p. ej. se deshizo una nota)', () => {
    expect(validatePlan([{ courseId: 'MAT-100', crn: null }], 31, context())).toContainEqual({
      kind: 'notAvailable',
      courseId: 'MAT-100',
    });
  });

  it('una materia sin oferta cargada no genera aviso de sección pendiente', () => {
    expect(validatePlan([{ courseId: 'ORI-112', crn: null }], 31, context())).toEqual([]);
  });
});

describe('criticalPathLengths', () => {
  it('mide la cadena de dependientes más larga', () => {
    const lengths = criticalPathLengths(COURSES);
    expect(lengths.get('MAT-095')).toBe(3); // MAT-095 → MAT-100 → MAT-110 / QUI-750
    expect(lengths.get('ORI-112')).toBe(1);
  });
});

describe('suggestPlan', () => {
  it('respeta el tope, agrupa correquisitos y no produce choques', () => {
    const ctx = context();
    const { items } = suggestPlan([], 12, ctx);
    const issues = validatePlan(items, 12, ctx);
    expect(issues.filter((i) => i.kind !== 'sectionPending')).toEqual([]);
    expect(items.reduce((sum, i) => sum + ctx.coursesById.get(i.courseId)!.credits, 0)).toBeLessThanOrEqual(12);
    const ids = items.map((i) => i.courseId);
    expect(ids.includes('BIO-100')).toBe(ids.includes('BIO-010'));
  });

  it('prioriza la materia que abre la cadena más larga', () => {
    const { added } = suggestPlan([], 4, context());
    expect(added).toEqual(['MAT-095']);
  });

  it('elige otra sección cuando la primera choca', () => {
    const { items } = suggestPlan([], 8, context());
    const bio = Object.fromEntries(items.map((i) => [i.courseId, i.crn]));
    expect(bio['MAT-095']).toBe('MAT0951');
    expect(bio['BIO-100']).toBe('BIO1002'); // BIO1001 choca con MAT0951 el lunes
    expect(bio['BIO-010']).toBe('BIO0102');
  });

  it('salta una materia cuya única sección choca y sigue con la siguiente', () => {
    const ctx = context();
    const start = [{ courseId: 'MAT-095', crn: 'MAT0952' }]; // jueves 8–11, igual que la única de ESP-095
    const { added } = suggestPlan(start, 31, ctx);
    expect(added).not.toContain('ESP-095');
    expect(added).toContain('ORI-112');
  });

  it('asigna sección a lo que ya estaba en el plan sin ella y no lo reemplaza', () => {
    const { items, sectioned } = suggestPlan([{ courseId: 'MAT-095', crn: null }], 4, context());
    expect(items).toEqual([{ courseId: 'MAT-095', crn: 'MAT0951' }]);
    expect(sectioned).toEqual(['MAT-095']);
  });

  it('completa un par si la teoría ya estaba en el plan', () => {
    const { added } = suggestPlan([{ courseId: 'BIO-100', crn: 'BIO1002' }], 4, context());
    expect(added).toEqual(['BIO-010']);
  });

  it('agrega electivas sólo hasta cubrir lo que falta del grupo', () => {
    const history: AttemptHistory = {
      'BIO-100': [graded('A')], 'BIO-010': [graded('A')], 'MAT-095': [graded('A')], 'MAT-100': [graded('A')],
      'MAT-110': [graded('A')], 'ESP-095': [graded('A')], 'ORI-112': [graded('A')], 'QUI-750': [graded('A')],
      'QUI-755': [graded('A')], 'GEN-001': [graded('A')], // 4 de 12 cr
    };
    const { added } = suggestPlan([], 31, context(history));
    expect(added).toEqual(['GEN-002']);
  });

  it('con materias en curso asumidas, sugiere lo que viene después', () => {
    const rest: AttemptHistory = {
      'BIO-100': [graded('A')], 'BIO-010': [graded('A')], 'ESP-095': [graded('A')], 'ORI-112': [graded('A')],
    };
    const ctx = context(rest, new Set(['MAT-095']));
    expect(suggestPlan([], 4, ctx).added).toEqual(['MAT-100']);
  });

  it('prioriza las obligatorias atrasadas sobre las del cuatrimestre siguiente', () => {
    const ctx = context({}, new Set(['MAT-095']));
    expect(suggestPlan([], 4, ctx).added).toEqual(['BIO-100', 'BIO-010']);
  });

  it('chooseSection sólo toca la materia indicada', () => {
    const items = [{ courseId: 'A', crn: null }, { courseId: 'B', crn: 'x' }];
    expect(chooseSection(items, 'A', 'y')).toEqual([{ courseId: 'A', crn: 'y' }, { courseId: 'B', crn: 'x' }]);
  });
});
