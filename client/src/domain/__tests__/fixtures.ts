import type { Attempt, Course, LetterGrade, Section, Weekday } from '../types';

/** Curso mínimo para tests: obligatorio de Premédica, 3 créditos, sin requisitos. */
export function course(id: string, overrides: Partial<Course> = {}): Course {
  return {
    id,
    name: id,
    credits: 3,
    theoreticalHours: 48,
    practicalHours: 0,
    term: 1,
    block: 'PREMEDICA',
    elective: null,
    prerequisites: [],
    corequisites: [],
    ...overrides,
  };
}

export const graded = (grade: LetterGrade, period: string | null = null): Attempt => ({ grade, period });
export const ungraded = (): Attempt => ({ grade: null, period: null });

export function section(courseId: string, crn: string, ...meetings: Array<[Weekday, string, string]>): Section {
  return {
    crn,
    courseId,
    room: 'A101',
    modality: 'presencial',
    meetings: meetings.map(([day, start, end]) => ({ day, start, end })),
  };
}
