import { BLOCKS, ELECTIVE_LABELS } from '@/domain/curriculum';
import { formatGpa } from '@/domain/grades';
import type { PlanIssue } from '@/domain/planner';
import type { BlockReason, CourseState, CourseStatus, EntryGap } from '@/domain/progress';
import { formatTime, WEEKDAY_SHORT } from '@/domain/schedule';
import type { Course, LetterGrade } from '@/domain/types';

export const STATUS_LABEL: Record<CourseStatus, string> = {
  passed: 'Aprobada',
  enrolled: 'Cursando',
  available: 'Disponible',
  blocked: 'Bloqueada',
};

export const GRADE_LABEL: Record<LetterGrade, string> = {
  A: 'A · 4.0',
  B: 'B · 3.0',
  C: 'C · 2.0',
  D: 'D · 1.0 (no aprueba)',
  F: 'F · 0.0 (no aprueba)',
};

export const termLabel = (term: number) => `${term}º cuatrimestre`;

/** Lista corta de claves: "MED-100, MED-010 y 3 más". */
export function shortList(ids: readonly string[], max = 3): string {
  if (ids.length <= max) return ids.join(', ');
  return `${ids.slice(0, max).join(', ')} y ${ids.length - max} más`;
}

export function describeReason(reason: BlockReason): string {
  switch (reason.kind) {
    case 'blockLocked':
      return `Todavía no tenés acceso a ${BLOCKS[reason.block].label}.`;
    case 'firstTerm':
      return 'Las electivas generales se cursan a partir del segundo cuatrimestre.';
    case 'prerequisites':
      return `Te falta aprobar ${shortList(reason.missing)}.`;
    case 'allMandatoryThroughTerm':
      return `Exige todas las obligatorias hasta el ${reason.term}º cuatrimestre. Faltan ${reason.missing.length}: ${shortList(reason.missing)}.`;
  }
}

export function describeGap(gap: EntryGap): string {
  switch (gap.kind) {
    case 'blockIncomplete':
      return `Completar ${BLOCKS[gap.block].label} (obligatorias y electivas).`;
    case 'gpaBelow':
      return `Índice acumulado de ${gap.required.toFixed(1)} o más (tenés ${formatGpa(gap.current)}).`;
  }
}

export function describeIssue(issue: PlanIssue, coursesById: ReadonlyMap<string, Course>): string {
  const name = (id: string) => coursesById.get(id)?.name ?? id;
  switch (issue.kind) {
    case 'notAvailable':
      return `${name(issue.courseId)} ya no se puede inscribir (se aprobó o le faltan requisitos).`;
    case 'missingCorequisite':
      return `${name(issue.courseId)} se cursa junto con ${name(issue.corequisiteId)}, que no está en el plan.`;
    case 'overCreditCap':
      return `El plan suma ${issue.credits} créditos y tu tope es ${issue.cap}.`;
    case 'scheduleConflict': {
      const { courseA, courseB, day, start, end } = issue.conflict;
      return `Choque de horario: ${name(courseA)} y ${name(courseB)} el ${WEEKDAY_SHORT[day]} de ${formatTime(start)} a ${formatTime(end)}.`;
    }
    case 'sectionPending':
      return `Falta elegir sección de ${name(issue.courseId)}.`;
    case 'unknownSection':
      return `La sección ${issue.crn} de ${name(issue.courseId)} ya no está en la oferta. Elegí otra.`;
  }
}

/** Avisos que impiden inscribir el plan; los demás son recordatorios. */
export const isBlockingIssue = (issue: PlanIssue) => issue.kind !== 'sectionPending';

export function courseFacts(course: Course): string {
  if (course.weeks) return `${course.credits} créditos · ${course.weeks} semanas`;
  return `${course.credits} créditos · HT ${course.theoreticalHours} · HP ${course.practicalHours}`;
}

export function courseGroupLabel(course: Course): string {
  return course.elective ? ELECTIVE_LABELS[course.elective] : course.term ? termLabel(course.term) : BLOCKS[course.block].label;
}

export function lastGrade(state: CourseState | undefined): string | null {
  const last = state?.attempts[state.attempts.length - 1];
  if (!last) return null;
  return last.grade ?? 'AP';
}
