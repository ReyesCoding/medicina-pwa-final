import type { ProgressSnapshot } from './progress';
import { findConflicts, sectionsConflict, type ScheduleConflict } from './schedule';
import type { Course, ElectiveGroup, PlanItem, Section } from './types';

export interface PlanContext {
  coursesById: ReadonlyMap<string, Course>;
  sectionsByCourse: ReadonlyMap<string, readonly Section[]>;
  /** Evaluado con las materias en curso como aprobadas si se planifica por adelantado. */
  snapshot: ProgressSnapshot;
}

const isDone = (ctx: PlanContext, id: string) => ctx.snapshot.courses.get(id)?.status === 'passed';

/**
 * La materia más todos sus correquisitos pendientes (cierre transitivo).
 * En el pensum los pares teoría/laboratorio son simétricos, pero el cierre
 * cubre también cadenas de más de dos sin suponer simetría.
 */
export function corequisiteGroup(courseId: string, ctx: PlanContext): string[] {
  const group = new Set([courseId]);
  const queue = [courseId];
  while (queue.length > 0) {
    const course = ctx.coursesById.get(queue.shift()!);
    for (const coreq of course?.corequisites ?? []) {
      if (!group.has(coreq) && !isDone(ctx, coreq)) {
        group.add(coreq);
        queue.push(coreq);
      }
    }
  }
  return [...group];
}

export const planCredits = (items: readonly PlanItem[], ctx: PlanContext): number =>
  items.reduce((sum, item) => sum + (ctx.coursesById.get(item.courseId)?.credits ?? 0), 0);

export type AddResult =
  | { ok: true; items: PlanItem[]; added: string[] }
  | { ok: false; reason: 'alreadyPlanned' | 'notAvailable'; courseId: string };

/** Agrega la materia con sus correquisitos pendientes; si alguno no se puede cursar, no agrega nada. */
export function addToPlan(items: readonly PlanItem[], courseId: string, ctx: PlanContext): AddResult {
  if (items.some((item) => item.courseId === courseId)) return { ok: false, reason: 'alreadyPlanned', courseId };
  const group = corequisiteGroup(courseId, ctx);
  const unavailable = group.find((id) => ctx.snapshot.courses.get(id)?.status !== 'available');
  if (unavailable) return { ok: false, reason: 'notAvailable', courseId: unavailable };

  const added = group.filter((id) => !items.some((item) => item.courseId === id));
  return { ok: true, items: [...items, ...added.map((id) => ({ courseId: id, crn: null }))], added };
}

/** Quita la materia y los correquisitos que dependen de ella: dejar uno solo sería un plan inválido. */
export function removeFromPlan(items: readonly PlanItem[], courseId: string, ctx: PlanContext) {
  const group = new Set(corequisiteGroup(courseId, ctx));
  const removed = items.filter((item) => group.has(item.courseId)).map((item) => item.courseId);
  return { items: items.filter((item) => !group.has(item.courseId)), removed };
}

export const chooseSection = (items: readonly PlanItem[], courseId: string, crn: string | null): PlanItem[] =>
  items.map((item) => (item.courseId === courseId ? { ...item, crn } : item));

export type PlanIssue =
  | { kind: 'notAvailable'; courseId: string }
  | { kind: 'missingCorequisite'; courseId: string; corequisiteId: string }
  | { kind: 'overCreditCap'; credits: number; cap: number }
  | { kind: 'scheduleConflict'; conflict: ScheduleConflict }
  | { kind: 'sectionPending'; courseId: string }
  | { kind: 'unknownSection'; courseId: string; crn: string };

export const findSection = (ctx: PlanContext, item: PlanItem): Section | undefined =>
  item.crn === null ? undefined : ctx.sectionsByCourse.get(item.courseId)?.find((s) => s.crn === item.crn);

/**
 * Revisa el plan contra el estado actual. Se recalcula en cada render en vez
 * de impedir estados inválidos porque el plan puede quedar viejo por razones
 * externas: el estudiante deshace una nota, o se publica una oferta nueva y
 * desaparece una sección.
 */
export function validatePlan(items: readonly PlanItem[], cap: number, ctx: PlanContext): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const planned = new Set(items.map((item) => item.courseId));

  for (const item of items) {
    if (ctx.snapshot.courses.get(item.courseId)?.status !== 'available') {
      issues.push({ kind: 'notAvailable', courseId: item.courseId });
    }
    for (const coreq of ctx.coursesById.get(item.courseId)?.corequisites ?? []) {
      if (!isDone(ctx, coreq) && !planned.has(coreq)) {
        issues.push({ kind: 'missingCorequisite', courseId: item.courseId, corequisiteId: coreq });
      }
    }
    if (item.crn !== null && !findSection(ctx, item)) {
      issues.push({ kind: 'unknownSection', courseId: item.courseId, crn: item.crn });
    } else if (item.crn === null && (ctx.sectionsByCourse.get(item.courseId)?.length ?? 0) > 0) {
      issues.push({ kind: 'sectionPending', courseId: item.courseId });
    }
  }

  const credits = planCredits(items, ctx);
  if (credits > cap) issues.push({ kind: 'overCreditCap', credits, cap });

  const chosen = items.flatMap((item) => {
    const section = findSection(ctx, item);
    return section ? [{ courseId: item.courseId, section }] : [];
  });
  for (const conflict of findConflicts(chosen)) issues.push({ kind: 'scheduleConflict', conflict });

  return issues;
}

/**
 * Largo de la cadena de materias que dependen (transitivamente) de cada una.
 * Una materia que abre una cadena larga retrasa la carrera entera si se
 * posterga, así que el sugeridor la prioriza.
 */
export function criticalPathLengths(courses: Iterable<Course>): Map<string, number> {
  const dependents = new Map<string, string[]>();
  const all = [...courses];
  for (const course of all) {
    for (const prereq of course.prerequisites) {
      dependents.set(prereq, [...(dependents.get(prereq) ?? []), course.id]);
    }
  }
  const memo = new Map<string, number>();
  const depth = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const value = 1 + Math.max(0, ...(dependents.get(id) ?? []).map(depth));
    memo.set(id, value);
    return value;
  };
  return new Map(all.map((course) => [course.id, depth(course.id)]));
}

/**
 * Busca una sección por materia sin choques entre sí ni con `taken`.
 * Backtracking: los grupos tienen 1–2 materias y como mucho ~70 secciones
 * cada una, así que el peor caso es chico.
 */
function pickSections(courseIds: readonly string[], taken: readonly Section[], ctx: PlanContext): PlanItem[] | null {
  const picked: PlanItem[] = [];
  const pickedSections: Section[] = [];

  const solve = (index: number): boolean => {
    if (index === courseIds.length) return true;
    const courseId = courseIds[index];
    const options = ctx.sectionsByCourse.get(courseId) ?? [];
    if (options.length === 0) {
      picked.push({ courseId, crn: null });
      if (solve(index + 1)) return true;
      picked.pop();
      return false;
    }
    for (const section of options) {
      if ([...taken, ...pickedSections].some((other) => sectionsConflict(section, other))) continue;
      picked.push({ courseId, crn: section.crn });
      pickedSections.push(section);
      if (solve(index + 1)) return true;
      picked.pop();
      pickedSections.pop();
    }
    return false;
  };

  return solve(0) ? picked : null;
}

export interface Suggestion {
  items: PlanItem[];
  added: string[];
  /** Materias que ya estaban en el plan y a las que se les asignó sección. */
  sectioned: string[];
}

/**
 * Completa el plan respetando lo que el estudiante ya eligió:
 *
 * 1. Asigna sección sin choques a las materias del plan que no tienen.
 * 2. Agrega obligatorias disponibles por grupo de correquisitos, primero las
 *    de cuatrimestres más bajos (las atrasadas) y, a igual cuatrimestre, las
 *    que abren la cadena de prerrequisitos más larga.
 * 3. Con los créditos que sobran, electivas de grupos que todavía no cumplen
 *    su mínimo, sin pasarse de lo que falta.
 *
 * Un grupo entra sólo si cabe en el tope de créditos y hay secciones que no
 * chocan; si no, se salta y se prueba el siguiente.
 */
export function suggestPlan(items: readonly PlanItem[], cap: number, ctx: PlanContext): Suggestion {
  let result = [...items];
  const sectioned: string[] = [];
  const takenSections = () => result.flatMap((item) => findSection(ctx, item) ?? []);

  for (const item of items) {
    if (item.crn !== null || (ctx.sectionsByCourse.get(item.courseId)?.length ?? 0) === 0) continue;
    const pick = pickSections([item.courseId], takenSections(), ctx);
    if (pick) {
      result = chooseSection(result, item.courseId, pick[0].crn);
      sectioned.push(item.courseId);
    }
  }

  const planned = new Set(result.map((item) => item.courseId));
  const seen = new Set<string>();
  const groups: string[][] = [];
  for (const [id, state] of ctx.snapshot.courses) {
    if (state.status !== 'available' || planned.has(id) || seen.has(id)) continue;
    // Si la teoría ya está en el plan y falta el laboratorio, el grupo es sólo el laboratorio.
    const group = corequisiteGroup(id, ctx).filter((member) => !planned.has(member));
    group.forEach((member) => seen.add(member));
    if (group.every((member) => ctx.snapshot.courses.get(member)?.status === 'available')) {
      groups.push(group);
    }
  }

  const critical = criticalPathLengths(ctx.coursesById.values());
  const courseOf = (id: string) => ctx.coursesById.get(id)!;
  const termOf = (group: string[]) => Math.min(...group.map((id) => courseOf(id).term ?? Number.MAX_SAFE_INTEGER));
  const pathOf = (group: string[]) => Math.max(...group.map((id) => critical.get(id) ?? 1));
  const isElectiveGroup = (group: string[]) => courseOf(group[0]).elective !== null;

  const ordered = groups.sort(
    (a, b) =>
      Number(isElectiveGroup(a)) - Number(isElectiveGroup(b)) ||
      termOf(a) - termOf(b) ||
      pathOf(b) - pathOf(a) ||
      a[0].localeCompare(b[0]),
  );

  // Créditos de electivas que todavía faltan por grupo, descontando las ya planificadas.
  const electiveNeed = new Map<ElectiveGroup, number>();
  for (const block of Object.values(ctx.snapshot.blocks)) {
    if (block.elective) electiveNeed.set(block.elective.group, block.elective.required - block.elective.earned);
  }
  for (const item of result) {
    const group = courseOf(item.courseId)?.elective;
    if (group) electiveNeed.set(group, (electiveNeed.get(group) ?? 0) - courseOf(item.courseId).credits);
  }

  let credits = planCredits(result, ctx);
  const added: string[] = [];
  for (const group of ordered) {
    const groupCredits = group.reduce((sum, id) => sum + courseOf(id).credits, 0);
    if (credits + groupCredits > cap) continue;
    const electiveGroup = courseOf(group[0]).elective;
    if (electiveGroup && (electiveNeed.get(electiveGroup) ?? 0) <= 0) continue;

    const pick = pickSections(group, takenSections(), ctx);
    if (!pick) continue;

    result = [...result, ...pick];
    added.push(...group);
    credits += groupCredits;
    if (electiveGroup) electiveNeed.set(electiveGroup, (electiveNeed.get(electiveGroup) ?? 0) - groupCredits);
  }

  return { items: result, added, sectioned };
}
