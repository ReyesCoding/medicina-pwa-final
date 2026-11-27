import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BLOCK_ORDER, BLOCKS, PENSUM } from '@/domain/curriculum';
import { evaluateProgress } from '@/domain/progress';
import { toMinutes } from '@/domain/schedule';
import type { AttemptHistory, BlockId } from '@/domain/types';
import { coursesFileSchema, sectionsFileSchema } from '../schemas';

/**
 * Tests sobre los JSON que se publican. Si alguien edita el pensum a mano o
 * regenera la oferta con un export nuevo, estos tests son la red de
 * seguridad: validan forma, referencias y los totales del PDF oficial.
 */
const DATA_DIR = path.resolve(__dirname, '../../../public/data');
const read = (file: string) => JSON.parse(readFileSync(path.join(DATA_DIR, file), 'utf8'));

const courses = coursesFileSchema.parse(read('courses.json'));
const sections = sectionsFileSchema.parse(read('sections.json'));
const byId = new Map(courses.map((c) => [c.id, c]));

describe('courses.json', () => {
  it('no repite claves', () => {
    expect(byId.size).toBe(courses.length);
  });

  it('todas las referencias apuntan a materias existentes', () => {
    const dangling = courses.flatMap((c) =>
      [...c.prerequisites, ...c.corequisites].filter((ref) => !byId.has(ref)).map((ref) => `${c.id} → ${ref}`),
    );
    expect(dangling).toEqual([]);
  });

  it('los correquisitos son simétricos (teoría ↔ laboratorio)', () => {
    const asymmetric = courses.flatMap((c) =>
      c.corequisites.filter((ref) => !byId.get(ref)!.corequisites.includes(c.id)).map((ref) => `${c.id} ↔ ${ref}`),
    );
    expect(asymmetric).toEqual([]);
  });

  it('los prerrequisitos no forman ciclos', () => {
    const state = new Map<string, 'visiting' | 'done'>();
    const visit = (id: string, trail: string[]): string[] | null => {
      if (state.get(id) === 'done') return null;
      if (state.get(id) === 'visiting') return [...trail, id];
      state.set(id, 'visiting');
      for (const prereq of byId.get(id)!.prerequisites) {
        const cycle = visit(prereq, [...trail, id]);
        if (cycle) return cycle;
      }
      state.set(id, 'done');
      return null;
    };
    for (const c of courses) expect(visit(c.id, [])).toBeNull();
  });

  it('las obligatorias tienen cuatrimestre y las electivas no', () => {
    expect(courses.filter((c) => (c.elective === null) !== (c.term !== null)).map((c) => c.id)).toEqual([]);
  });

  it('cada bloque suma los créditos del PDF oficial', () => {
    const mandatory = (block: BlockId) =>
      courses.filter((c) => c.block === block && c.elective === null).reduce((s, c) => s + c.credits, 0);
    expect(Object.fromEntries(BLOCK_ORDER.map((b) => [b, mandatory(b)]))).toEqual({
      PREMEDICA: 132,
      BASICAS: 117,
      CLINICAS: 108,
      INTERNADO: 60,
      PROYECTO_GRADO: 6,
    });
    const requiredElectives = BLOCK_ORDER.reduce((s, b) => s + (BLOCKS[b].electives?.credits ?? 0), 0);
    expect(132 + 117 + 108 + 60 + 6 + requiredElectives).toBe(PENSUM.totalCredits);
  });

  it('cada grupo de electivas ofrece al menos los créditos que exige', () => {
    for (const block of BLOCK_ORDER) {
      const rule = BLOCKS[block].electives;
      if (!rule) continue;
      const offered = courses.filter((c) => c.elective === rule.group).reduce((s, c) => s + c.credits, 0);
      expect(offered, block).toBeGreaterThanOrEqual(rule.credits);
    }
  });

  /**
   * Prueba de punta a punta de las reglas sobre el pensum real: un estudiante
   * que aprueba con A todo lo disponible, cuatrimestre tras cuatrimestre,
   * tiene que poder graduarse. Detecta materias inalcanzables (como ADM-900
   * con un prerrequisito escrito en texto libre) y puertas mal configuradas.
   */
  it('todo el pensum es alcanzable aprobando en orden', () => {
    const history: AttemptHistory = {};
    for (let term = 1; term <= 40; term++) {
      const available = [...evaluateProgress(courses, history).courses].filter(([, s]) => s.status === 'available');
      if (available.length === 0) break;
      for (const [id] of available) history[id] = [{ grade: 'A', period: null }];
    }
    const progress = evaluateProgress(courses, history);
    const unreachable = [...progress.courses].filter(([, s]) => s.status !== 'passed').map(([id]) => id);
    expect(unreachable).toEqual([]);
    expect(progress.degreeCredits).toBe(PENSUM.totalCredits);
  });
});

describe('sections.json', () => {
  it('cada sección es de una materia del pensum y no repite CRN', () => {
    expect(sections.filter((s) => !byId.has(s.courseId)).map((s) => s.crn)).toEqual([]);
    expect(new Set(sections.map((s) => s.crn)).size).toBe(sections.length);
  });

  it('los horarios caen entre 7:00 y 22:00', () => {
    const outOfRange = sections.filter((s) =>
      s.meetings.some((m) => toMinutes(m.start) < 7 * 60 || toMinutes(m.end) > 22 * 60),
    );
    expect(outOfRange.map((s) => s.crn)).toEqual([]);
  });

  /**
   * Invariante fuerte del parser: los minutos semanales de cada sección
   * presencial deben igualar las horas del pensum (horas de 45 min en 16
   * semanas). Un am/pm mal interpretado rompe esta igualdad.
   */
  it('la carga semanal de cada sección coincide con las horas del pensum', () => {
    const mismatched = sections
      .filter((s) => s.meetings.length > 0)
      .filter((s) => {
        const course = byId.get(s.courseId)!;
        const weekly = s.meetings.reduce((sum, m) => sum + toMinutes(m.end) - toMinutes(m.start), 0);
        return weekly !== ((course.theoreticalHours + course.practicalHours) / 16) * 45;
      })
      .map((s) => s.crn);
    expect(mismatched).toEqual([]);
  });
});
