import { useCallback } from 'react';
import { toast } from '@/hooks/use-toast';
import { addToPlan, chooseSection, removeFromPlan, suggestPlan } from '@/domain/planner';
import { useAcademic, useDataset, useStudent } from '@/state/app-state';
import { describeReason } from '../shared/labels';

/** Acciones del plan con su feedback al usuario; la lógica está en domain/planner. */
export function usePlanActions() {
  const { coursesById } = useDataset();
  const { data, dispatch } = useStudent();
  const { planContext } = useAcademic();
  const items = data.plan.items;
  const name = useCallback((id: string) => coursesById.get(id)?.name ?? id, [coursesById]);

  const add = useCallback(
    (courseId: string) => {
      const result = addToPlan(items, courseId, planContext);
      if (!result.ok) {
        const state = planContext.snapshot.courses.get(result.courseId);
        const why = state?.reasons[0] ? describeReason(state.reasons[0]) : 'No está disponible.';
        toast({
          title: result.reason === 'alreadyPlanned' ? 'Ya está en el plan' : `No se puede agregar ${name(result.courseId)}`,
          description: result.reason === 'alreadyPlanned' ? undefined : why,
        });
        return;
      }
      dispatch({ type: 'setPlanItems', items: result.items });
      const extra = result.added.filter((id) => id !== courseId);
      toast({
        title: `${name(courseId)} agregada al plan`,
        description: extra.length > 0 ? `También se agregó ${extra.map(name).join(', ')} (correquisito).` : undefined,
      });
    },
    [items, planContext, dispatch, name],
  );

  const remove = useCallback(
    (courseId: string) => {
      const result = removeFromPlan(items, courseId, planContext);
      dispatch({ type: 'setPlanItems', items: result.items });
      const extra = result.removed.filter((id) => id !== courseId);
      if (extra.length > 0) {
        toast({ title: 'Se quitaron juntas', description: `${extra.map(name).join(', ')} es correquisito de ${name(courseId)}.` });
      }
    },
    [items, planContext, dispatch, name],
  );

  const choose = useCallback(
    (courseId: string, crn: string | null) => dispatch({ type: 'setPlanItems', items: chooseSection(items, courseId, crn) }),
    [items, dispatch],
  );

  const suggest = useCallback(() => {
    const result = suggestPlan(items, data.plan.creditCap, planContext);
    if (result.added.length === 0 && result.sectioned.length === 0) {
      toast({
        title: 'No hay nada más para agregar',
        description: 'No quedan materias disponibles que entren en el tope de créditos sin chocar de horario.',
      });
      return;
    }
    dispatch({ type: 'setPlanItems', items: result.items });
    const parts = [
      result.added.length > 0 && `${result.added.length} materia(s) agregada(s)`,
      result.sectioned.length > 0 && `sección asignada a ${result.sectioned.length}`,
    ].filter(Boolean);
    toast({ title: 'Plan sugerido', description: `${parts.join(' y ')}. Revisalo antes de inscribir.` });
  }, [items, data.plan.creditCap, planContext, dispatch]);

  const isPlanned = useCallback((courseId: string) => items.some((item) => item.courseId === courseId), [items]);

  return { add, remove, choose, suggest, isPlanned };
}
