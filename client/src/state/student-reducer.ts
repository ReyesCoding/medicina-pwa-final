import { hasPassed } from '@/domain/grades';
import type { Attempt, PlanItem } from '@/domain/types';
import { emptyStudentData, type StudentData } from './storage';

export type StudentAction =
  | { type: 'recordAttempts'; entries: Array<{ courseId: string; attempt: Attempt }> }
  | { type: 'deleteAttempt'; courseId: string; index: number }
  | { type: 'setPlanItems'; items: PlanItem[] }
  | { type: 'setCreditCap'; creditCap: number }
  | { type: 'setAssumeCurrentPassed'; value: boolean }
  /** Pasa el plan a "cursando ahora" y lo vacía. */
  | { type: 'enrollPlan'; period: string }
  | { type: 'dropCurrent'; courseId: string }
  | { type: 'replace'; data: StudentData }
  | { type: 'reset' };

/**
 * Reducer puro del estudiante. Las reglas del pensum no viven acá (están en
 * domain/); este reducer sólo garantiza coherencia entre historial, materias
 * en curso y plan.
 */
export function studentReducer(state: StudentData, action: StudentAction): StudentData {
  switch (action.type) {
    case 'recordAttempts': {
      const history = { ...state.history };
      for (const { courseId, attempt } of action.entries) history[courseId] = [...(history[courseId] ?? []), attempt];
      const recorded = new Set(action.entries.map((entry) => entry.courseId));
      return {
        ...state,
        history,
        // Una materia con nota ya no se está cursando.
        current: { ...state.current, items: state.current.items.filter((item) => !recorded.has(item.courseId)) },
        // Lo que se aprobó no tiene sentido en el plan.
        plan: { ...state.plan, items: state.plan.items.filter((item) => !hasPassed(history[item.courseId])) },
      };
    }
    case 'deleteAttempt': {
      const remaining = (state.history[action.courseId] ?? []).filter((_, index) => index !== action.index);
      const history = { ...state.history };
      if (remaining.length > 0) history[action.courseId] = remaining;
      else delete history[action.courseId];
      return { ...state, history };
    }
    case 'setPlanItems':
      return { ...state, plan: { ...state.plan, items: action.items } };
    case 'setCreditCap':
      return { ...state, plan: { ...state.plan, creditCap: action.creditCap } };
    case 'setAssumeCurrentPassed':
      return { ...state, plan: { ...state.plan, assumeCurrentPassed: action.value } };
    case 'enrollPlan':
      return {
        ...state,
        current: { period: action.period, items: state.plan.items },
        plan: { ...state.plan, items: [] },
      };
    case 'dropCurrent': {
      const items = state.current.items.filter((item) => item.courseId !== action.courseId);
      return { ...state, current: { period: items.length > 0 ? state.current.period : null, items } };
    }
    case 'replace':
      return action.data;
    case 'reset':
      return emptyStudentData();
  }
}
