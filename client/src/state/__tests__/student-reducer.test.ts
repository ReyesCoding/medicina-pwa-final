import { describe, expect, it } from 'vitest';
import { emptyStudentData, type StudentData } from '../storage';
import { studentReducer } from '../student-reducer';

const base = (): StudentData => ({
  ...emptyStudentData(),
  current: { period: '2026-3', items: [{ courseId: 'MAT-100', crn: 'X' }, { courseId: 'ESP-181', crn: null }] },
  plan: { ...emptyStudentData().plan, items: [{ courseId: 'MAT-110', crn: null }, { courseId: 'ING-110', crn: null }] },
});

describe('studentReducer', () => {
  it('registrar una nota la saca de "cursando"; si aprueba, también del plan', () => {
    const next = studentReducer(base(), {
      type: 'recordAttempts',
      entries: [
        { courseId: 'MAT-100', attempt: { grade: 'F', period: '2026-3' } },
        { courseId: 'ING-110', attempt: { grade: 'B', period: '2026-3' } },
      ],
    });
    expect(next.current.items).toEqual([{ courseId: 'ESP-181', crn: null }]);
    expect(next.plan.items).toEqual([{ courseId: 'MAT-110', crn: null }]);
    expect(next.history['MAT-100']).toEqual([{ grade: 'F', period: '2026-3' }]);
  });

  it('agrega intentos sin pisar los anteriores', () => {
    const once = studentReducer(base(), {
      type: 'recordAttempts',
      entries: [{ courseId: 'MAT-100', attempt: { grade: 'F', period: '2026-2' } }],
    });
    const twice = studentReducer(once, {
      type: 'recordAttempts',
      entries: [{ courseId: 'MAT-100', attempt: { grade: 'B', period: '2026-3' } }],
    });
    expect(twice.history['MAT-100']).toHaveLength(2);
  });

  it('borrar el último intento elimina la materia del historial', () => {
    const withAttempt = { ...base(), history: { 'MAT-095': [{ grade: 'A' as const, period: null }] } };
    expect(studentReducer(withAttempt, { type: 'deleteAttempt', courseId: 'MAT-095', index: 0 }).history).toEqual({});
  });

  it('inscribir pasa el plan a "cursando" y lo vacía', () => {
    const next = studentReducer(base(), { type: 'enrollPlan', period: '2027-1' });
    expect(next.current).toEqual({ period: '2027-1', items: base().plan.items });
    expect(next.plan.items).toEqual([]);
  });

  it('al retirar la última materia en curso se limpia el período', () => {
    let state = studentReducer(base(), { type: 'dropCurrent', courseId: 'MAT-100' });
    state = studentReducer(state, { type: 'dropCurrent', courseId: 'ESP-181' });
    expect(state.current).toEqual({ period: null, items: [] });
  });
});
