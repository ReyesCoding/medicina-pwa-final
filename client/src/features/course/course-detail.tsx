import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Check, History, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { BLOCKS } from '@/domain/curriculum';
import { formatPeriod, periodOf } from '@/domain/period';
import { describeSection } from '@/domain/schedule';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAcademic, useDataset, useStudent } from '@/state/app-state';
import { usePlanActions } from '../planner/use-plan-actions';
import { GradeSelect, PeriodSelect, RetakeBadge, StatusBadge, toAttemptGrade, type GradeChoice } from '../shared/controls';
import { courseFacts, courseGroupLabel, describeReason } from '../shared/labels';

const CourseDetailContext = createContext<(courseId: string) => void>(() => undefined);

/** Permite abrir el detalle de cualquier materia desde cualquier vista. */
export const useOpenCourse = () => useContext(CourseDetailContext);

export function CourseDetailProvider({ children }: { children: ReactNode }) {
  const [courseId, setCourseId] = useState<string | null>(null);
  return (
    <CourseDetailContext.Provider value={setCourseId}>
      {children}
      <Dialog open={courseId !== null} onOpenChange={(open) => !open && setCourseId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          {courseId && <CourseDetail key={courseId} courseId={courseId} onNavigate={setCourseId} />}
        </DialogContent>
      </Dialog>
    </CourseDetailContext.Provider>
  );
}

function CourseDetail({ courseId, onNavigate }: { courseId: string; onNavigate: (id: string) => void }) {
  const { coursesById, sectionsByCourse } = useDataset();
  const { snapshot, planContext } = useAcademic();
  const plan = usePlanActions();
  const course = coursesById.get(courseId)!;
  const state = snapshot.courses.get(courseId)!;
  const sections = sectionsByCourse.get(courseId) ?? [];
  const canPlan = planContext.snapshot.courses.get(courseId)?.status === 'available';

  return (
    <div className="space-y-5">
      <DialogHeader className="space-y-2 text-left">
        <p className="font-mono text-sm text-primary">{course.id}</p>
        <DialogTitle className="text-xl leading-tight">{course.name}</DialogTitle>
        <DialogDescription>
          {courseGroupLabel(course)} · {BLOCKS[course.block].label}
        </DialogDescription>
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={state.status} />
          <RetakeBadge count={state.status === 'passed' ? 0 : state.failedAttempts} />
        </div>
        <p className="text-sm text-muted-foreground">{courseFacts(course)}</p>
      </DialogHeader>

      {state.reasons.length > 0 && (
        <section aria-label="Por qué está bloqueada" className="rounded-lg border border-border bg-muted/40 p-3">
          <h3 className="mb-1 text-sm font-semibold">Por qué no podés inscribirla todavía</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {state.reasons.map((reason) => (
              <li key={reason.kind}>{describeReason(reason)}</li>
            ))}
          </ul>
        </section>
      )}

      <RequirementList title="Prerrequisitos" ids={course.prerequisites} onNavigate={onNavigate} empty="Ninguno" />
      {course.corequisites.length > 0 && (
        <RequirementList
          title="Correquisitos (se cursan en el mismo cuatrimestre)"
          ids={course.corequisites}
          onNavigate={onNavigate}
        />
      )}

      {(canPlan || plan.isPlanned(courseId)) && (
        <Button
          className="h-11 w-full"
          variant={plan.isPlanned(courseId) ? 'outline' : 'default'}
          onClick={() => (plan.isPlanned(courseId) ? plan.remove(courseId) : plan.add(courseId))}
        >
          {plan.isPlanned(courseId) ? <X /> : <Plus />}
          {plan.isPlanned(courseId) ? 'Quitar del plan' : 'Agregar al plan del próximo cuatrimestre'}
        </Button>
      )}

      <AttemptsSection courseId={courseId} />

      {sections.length > 0 && (
        <details className="group rounded-lg border border-border">
          <summary className="cursor-pointer select-none p-3 text-sm font-semibold">
            Oferta de secciones ({sections.length})
          </summary>
          <ul className="max-h-60 divide-y divide-border overflow-y-auto border-t border-border text-sm">
            {sections.map((section) => (
              <li key={section.crn} className="flex justify-between gap-3 px-3 py-2">
                <span>{describeSection(section)}</span>
                <span className="shrink-0 text-muted-foreground">{section.room}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function RequirementList({
  title,
  ids,
  onNavigate,
  empty,
}: {
  title: string;
  ids: string[];
  onNavigate: (id: string) => void;
  empty?: string;
}) {
  const { coursesById } = useDataset();
  const { snapshot } = useAcademic();
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {ids.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {ids.map((id) => {
            const passed = snapshot.courses.get(id)?.status === 'passed';
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onNavigate(id)}
                  className={cn(
                    'flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    passed ? 'border-emerald-500/40 text-emerald-200' : 'border-border',
                  )}
                  aria-label={`${coursesById.get(id)?.name ?? id}, ${passed ? 'aprobada' : 'pendiente'}`}
                >
                  {passed ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-muted-foreground" />}
                  <span className="font-mono">{id}</span>
                  <span className="hidden text-muted-foreground sm:inline">{coursesById.get(id)?.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AttemptsSection({ courseId }: { courseId: string }) {
  const { data, dispatch } = useStudent();
  const { snapshot } = useAcademic();
  const state = snapshot.courses.get(courseId)!;
  const attempts = data.history[courseId] ?? [];
  const [grade, setGrade] = useState<GradeChoice>();
  const defaultPeriod = useMemo(() => data.current.period ?? periodOf(new Date()), [data.current.period]);
  const [period, setPeriod] = useState<string | null>(state.status === 'enrolled' ? defaultPeriod : null);

  const save = useCallback(() => {
    if (!grade) return;
    dispatch({ type: 'recordAttempts', entries: [{ courseId, attempt: { grade: toAttemptGrade(grade), period } }] });
    toast({ title: 'Nota guardada' });
    setGrade(undefined);
  }, [grade, period, courseId, dispatch]);

  return (
    <section className="space-y-3 rounded-lg border border-border p-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4" /> Historial
      </h3>
      {attempts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin notas registradas.</p>
      ) : (
        <ul className="divide-y divide-border text-sm">
          {attempts.map((attempt, index) => (
            <li key={index} className="flex items-center justify-between gap-2 py-1.5">
              <span>
                <strong>{attempt.grade ?? 'Aprobada (sin nota)'}</strong>
                <span className="text-muted-foreground"> · {attempt.period ? formatPeriod(attempt.period) : 'cuatrimestre sin indicar'}</span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-muted-foreground"
                aria-label={`Borrar nota ${attempt.grade ?? 'aprobada'}`}
                onClick={() => dispatch({ type: 'deleteAttempt', courseId, index })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {state.status !== 'passed' && (
        <div className="space-y-3 border-t border-border pt-3">
          <p className="text-sm font-medium">{attempts.length > 0 ? 'Registrar otro intento' : 'Registrar nota'}</p>
          {state.status === 'blocked' && (
            <p className="text-xs text-amber-200/90">
              Según el pensum todavía no cumplís los requisitos. Podés registrarla igual si ya la cursaste (por
              ejemplo, por convalidación o porque te faltan cargar materias anteriores).
            </p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`grade-${courseId}`}>Calificación</Label>
              <GradeSelect id={`grade-${courseId}`} value={grade} onChange={setGrade} />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`period-${courseId}`}>Cuatrimestre</Label>
              <PeriodSelect id={`period-${courseId}`} value={period} onChange={setPeriod} />
            </div>
          </div>
          <Button className="h-11 w-full" disabled={!grade} onClick={save}>
            Guardar nota
          </Button>
        </div>
      )}
    </section>
  );
}
