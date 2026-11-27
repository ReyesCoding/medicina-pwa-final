import { useMemo, useState } from 'react';
import { AlertTriangle, CalendarCheck, Info, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ELECTIVE_LABELS } from '@/domain/curriculum';
import { enrollmentPeriodFor, formatPeriod } from '@/domain/period';
import { findSection, planCredits, validatePlan, type PlanIssue } from '@/domain/planner';
import { describeSection } from '@/domain/schedule';
import type { Course, PlanItem } from '@/domain/types';
import { useMediaQuery } from '@/hooks/use-media-query';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAcademic, useDataset, useStudent } from '@/state/app-state';
import { TermGradesDialog } from '../catalog/term-grades-dialog';
import { useOpenCourse } from '../course/course-detail';
import { PeriodSelect } from '../shared/controls';
import { describeIssue, isBlockingIssue, termLabel } from '../shared/labels';
import { usePlanActions } from './use-plan-actions';
import { WeekGrid, type GridEntry } from './week-grid';

export function PlannerView() {
  const { coursesById } = useDataset();
  const { data, dispatch } = useStudent();
  const { planContext } = useAcademic();
  const { items, creditCap } = data.plan;

  const issues = useMemo(() => validatePlan(items, creditCap, planContext), [items, creditCap, planContext]);
  const credits = planCredits(items, planContext);
  const conflicted = useMemo(
    () =>
      new Set(
        issues.flatMap((i) => (i.kind === 'scheduleConflict' ? [i.conflict.courseA, i.conflict.courseB] : [])),
      ),
    [issues],
  );
  const grid = useMemo(() => gridEntries(items, planContext, coursesById, conflicted), [items, planContext, coursesById, conflicted]);
  const wide = useMediaQuery('(min-width: 1024px)');

  return (
    <div className="space-y-6">
      {data.current.items.length > 0 && <CurrentTermCard />}

      <section aria-labelledby="plan-title" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="plan-title" className="text-lg font-semibold">
              Próximo cuatrimestre
            </h2>
            <p className="text-sm text-muted-foreground">
              Armá tu selección: las materias con correquisito se agregan y se quitan juntas.
            </p>
          </div>
          <PlanToolbar issues={issues} />
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span>
              <strong className={cn(credits > creditCap && 'text-destructive')}>{credits}</strong> de {creditCap} créditos
            </span>
            <span className="flex items-center gap-2">
              <Label htmlFor="credit-cap" className="text-muted-foreground">
                Tope
              </Label>
              <Input
                id="credit-cap"
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={creditCap}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (Number.isInteger(value) && value >= 1 && value <= 60) dispatch({ type: 'setCreditCap', creditCap: value });
                }}
                className="h-9 w-20"
              />
            </span>
          </div>
          <Progress value={Math.min(100, (credits / creditCap) * 100)} aria-label="Créditos del plan respecto al tope" />
          {data.current.items.length > 0 && (
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[hsl(217,91%,60%)]"
                checked={data.plan.assumeCurrentPassed}
                onChange={(e) => dispatch({ type: 'setAssumeCurrentPassed', value: e.target.checked })}
              />
              Planificar asumiendo que apruebo lo que estoy cursando
            </label>
          )}
        </div>

        <IssueList issues={issues} />

        {wide ? (
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-6">
            <div className="space-y-6">
              <PlanList conflicted={conflicted} />
              {items.length > 0 && <WeekGrid entries={grid} />}
            </div>
            <AvailableCourses />
          </div>
        ) : (
          <Tabs defaultValue="plan">
            <TabsList className="grid h-11 w-full grid-cols-3">
              <TabsTrigger value="plan" className="h-9">
                Plan ({items.length})
              </TabsTrigger>
              <TabsTrigger value="grid" className="h-9">
                Horario
              </TabsTrigger>
              <TabsTrigger value="add" className="h-9">
                Agregar
              </TabsTrigger>
            </TabsList>
            <TabsContent value="plan">
              <PlanList conflicted={conflicted} />
            </TabsContent>
            <TabsContent value="grid">
              {items.length > 0 ? (
                <WeekGrid entries={grid} />
              ) : (
                <p className="p-6 text-center text-sm text-muted-foreground">Agregá materias al plan para ver tu horario.</p>
              )}
            </TabsContent>
            <TabsContent value="add">
              <AvailableCourses />
            </TabsContent>
          </Tabs>
        )}
      </section>
    </div>
  );
}

function gridEntries(
  items: PlanItem[],
  ctx: ReturnType<typeof useAcademic>['planContext'],
  coursesById: ReadonlyMap<string, Course>,
  conflicted: Set<string>,
): GridEntry[] {
  return items.map((item) => ({
    courseId: item.courseId,
    name: coursesById.get(item.courseId)?.name ?? item.courseId,
    section: findSection(ctx, item),
    conflicted: conflicted.has(item.courseId),
  }));
}

function PlanToolbar({ issues }: { issues: PlanIssue[] }) {
  const { data, dispatch } = useStudent();
  const plan = usePlanActions();
  const [confirm, setConfirm] = useState<'clear' | 'enroll' | null>(null);
  const [period, setPeriod] = useState<string | null>(() => enrollmentPeriodFor(new Date()));
  const blocking = issues.filter(isBlockingIssue);
  const empty = data.plan.items.length === 0;
  const busy = data.current.items.length > 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button className="h-11" onClick={plan.suggest}>
        <Sparkles /> Sugerir plan
      </Button>
      <Button
        variant="secondary"
        className="h-11"
        disabled={empty || blocking.length > 0 || busy}
        title={busy ? 'Primero registrá las notas de lo que estás cursando' : undefined}
        onClick={() => setConfirm('enroll')}
      >
        <CalendarCheck /> Ya me inscribí
      </Button>
      <Button variant="ghost" className="h-11" disabled={empty} onClick={() => setConfirm('clear')}>
        <Trash2 /> Vaciar
      </Button>

      <AlertDialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          {confirm === 'clear' ? (
            <AlertDialogHeader>
              <AlertDialogTitle>¿Vaciar el plan?</AlertDialogTitle>
              <AlertDialogDescription>Se quitan todas las materias del plan. Tu historial de notas no cambia.</AlertDialogDescription>
            </AlertDialogHeader>
          ) : (
            <AlertDialogHeader>
              <AlertDialogTitle>Pasar el plan a “Cursando”</AlertDialogTitle>
              <AlertDialogDescription>
                Las materias quedan como en curso. Cuando termine el cuatrimestre, registrás las notas desde esta misma pantalla.
              </AlertDialogDescription>
              <div className="space-y-1 pt-2 text-left">
                <Label htmlFor="enroll-period">Cuatrimestre</Label>
                <PeriodSelect id="enroll-period" value={period} onChange={setPeriod} includeNext allowNone={false} />
              </div>
            </AlertDialogHeader>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="h-11"
              onClick={() => {
                if (confirm === 'clear') dispatch({ type: 'setPlanItems', items: [] });
                else if (period) {
                  dispatch({ type: 'enrollPlan', period });
                  toast({ title: `Inscripción guardada · ${formatPeriod(period)}` });
                }
              }}
            >
              {confirm === 'clear' ? 'Vaciar' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IssueList({ issues }: { issues: PlanIssue[] }) {
  const { coursesById } = useDataset();
  if (issues.length === 0) return null;
  return (
    <ul className="space-y-2" aria-label="Avisos del plan">
      {issues.map((issue, index) => {
        const blocking = isBlockingIssue(issue);
        return (
          <li
            key={index}
            className={cn(
              'flex gap-2 rounded-lg border p-3 text-sm',
              blocking ? 'border-amber-400/50 bg-amber-500/10 text-amber-100' : 'border-border bg-muted/40 text-muted-foreground',
            )}
          >
            {blocking ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            {describeIssue(issue, coursesById)}
          </li>
        );
      })}
    </ul>
  );
}

function PlanList({ conflicted }: { conflicted: Set<string> }) {
  const { coursesById, sectionsByCourse } = useDataset();
  const { data } = useStudent();
  const plan = usePlanActions();
  const openCourse = useOpenCourse();

  if (data.plan.items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
        El plan está vacío. Tocá <strong>Sugerir plan</strong> o agregá materias desde la lista de disponibles.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {data.plan.items.map((item) => {
        const course = coursesById.get(item.courseId);
        const sections = sectionsByCourse.get(item.courseId) ?? [];
        return (
          <li
            key={item.courseId}
            className={cn('space-y-2 rounded-lg border bg-card p-3', conflicted.has(item.courseId) ? 'border-destructive' : 'border-border')}
          >
            <div className="flex items-start justify-between gap-2">
              <button type="button" className="min-w-0 text-left" onClick={() => openCourse(item.courseId)}>
                <span className="font-mono text-xs text-primary">{item.courseId}</span>
                <span className="block font-medium leading-snug">{course?.name ?? 'Materia desconocida'}</span>
                <span className="text-xs text-muted-foreground">{course?.credits ?? 0} créditos</span>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 shrink-0"
                aria-label={`Quitar ${course?.name ?? item.courseId} del plan`}
                onClick={() => plan.remove(item.courseId)}
              >
                <X />
              </Button>
            </div>
            {sections.length > 0 ? (
              <Select value={item.crn ?? ''} onValueChange={(crn) => plan.choose(item.courseId, crn)}>
                <SelectTrigger className="h-11 text-left" aria-label={`Sección de ${course?.name}`}>
                  <SelectValue placeholder={`Elegir sección (${sections.length} disponibles)`} />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.crn} value={s.crn}>
                      {describeSection(s)} · {s.room}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">Sin oferta de secciones cargada para esta materia.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function AvailableCourses() {
  const { courses, sectionsByCourse } = useDataset();
  const { data } = useStudent();
  const { planContext } = useAcademic();
  const plan = usePlanActions();
  const openCourse = useOpenCourse();
  const [query, setQuery] = useState('');

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return courses.filter(
      (c) =>
        planContext.snapshot.courses.get(c.id)?.status === 'available' &&
        !plan.isPlanned(c.id) &&
        (q === '' || c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
    );
  }, [courses, planContext, plan, query]);

  const mandatory = available.filter((c) => c.elective === null).sort((a, b) => (a.term ?? 0) - (b.term ?? 0));
  const electiveGroups = Object.values(planContext.snapshot.blocks).flatMap((block) => {
    if (!block.elective) return [];
    const list = available.filter((c) => c.elective === block.elective!.group);
    const missing = Math.max(0, block.elective.required - block.elective.earned);
    return list.length > 0 ? [{ group: block.elective.group, list, missing }] : [];
  });

  return (
    <section aria-labelledby="available-title" className="space-y-3">
      <h3 id="available-title" className="font-semibold">
        Disponibles para inscribir
      </h3>
      {data.current.items.length > 0 && data.plan.assumeCurrentPassed && (
        <p className="text-xs text-muted-foreground">Incluye lo que se habilita si aprobás lo que estás cursando.</p>
      )}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar" aria-label="Filtrar disponibles" className="h-11 pl-9" />
      </div>
      {available.length === 0 && <p className="text-sm text-muted-foreground">No hay más materias disponibles.</p>}
      <CourseRows title="Obligatorias" courses={mandatory} onAdd={plan.add} onOpen={openCourse} sectionsByCourse={sectionsByCourse} />
      {electiveGroups.map(({ group, list, missing }) => (
        <CourseRows
          key={group}
          title={`${ELECTIVE_LABELS[group]} · ${missing > 0 ? `te faltan ${missing} cr` : 'requisito cumplido'}`}
          courses={list}
          onAdd={plan.add}
          onOpen={openCourse}
          sectionsByCourse={sectionsByCourse}
        />
      ))}
    </section>
  );
}

function CourseRows({
  title,
  courses,
  onAdd,
  onOpen,
  sectionsByCourse,
}: {
  title: string;
  courses: Course[];
  onAdd: (id: string) => void;
  onOpen: (id: string) => void;
  sectionsByCourse: ReadonlyMap<string, readonly unknown[]>;
}) {
  if (courses.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {courses.map((course) => (
          <li key={course.id} className="flex items-center gap-2 px-3 py-1.5">
            <button type="button" className="min-w-0 flex-1 py-1 text-left" onClick={() => onOpen(course.id)}>
              <span className="block truncate text-sm font-medium">{course.name}</span>
              <span className="text-xs text-muted-foreground">
                {course.id} · {course.credits} cr{course.term ? ` · ${termLabel(course.term)}` : ''} ·{' '}
                {sectionsByCourse.get(course.id)?.length ?? 0} secciones
              </span>
            </button>
            <Button size="icon" variant="outline" className="h-11 w-11 shrink-0" aria-label={`Agregar ${course.name}`} onClick={() => onAdd(course.id)}>
              <Plus />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CurrentTermCard() {
  const { coursesById, sectionsByCourse } = useDataset();
  const { data, dispatch } = useStudent();
  const [closing, setClosing] = useState(false);
  const { period, items } = data.current;
  const courses = items.map((i) => coursesById.get(i.courseId)).filter((c): c is Course => c !== undefined);

  return (
    <section aria-labelledby="current-title" className="space-y-3 rounded-lg border border-violet-400/40 bg-violet-500/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="current-title" className="text-lg font-semibold">
            Cursando ahora{period ? ` · ${formatPeriod(period)}` : ''}
          </h2>
          <p className="text-sm text-muted-foreground">
            {courses.length} materias · {courses.reduce((s, c) => s + c.credits, 0)} créditos
          </p>
        </div>
        <Button className="h-11" onClick={() => setClosing(true)}>
          Registrar notas finales
        </Button>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => {
          const section = item.crn ? sectionsByCourse.get(item.courseId)?.find((s) => s.crn === item.crn) : undefined;
          return (
            <li key={item.courseId} className="rounded-md bg-card p-2 text-sm">
              <span className="font-mono text-xs text-primary">{item.courseId}</span>{' '}
              <span className="font-medium">{coursesById.get(item.courseId)?.name}</span>
              {section && <span className="block text-xs text-muted-foreground">{describeSection(section)}</span>}
            </li>
          );
        })}
      </ul>
      <TermGradesDialog
        open={closing}
        onOpenChange={setClosing}
        title="Notas finales del cuatrimestre"
        description="Las aprobadas desbloquean lo siguiente; D y F quedan registradas y cuentan en tu índice."
        courses={courses}
        defaultPeriod={period}
        onDrop={(courseId) => dispatch({ type: 'dropCurrent', courseId })}
      />
    </section>
  );
}
