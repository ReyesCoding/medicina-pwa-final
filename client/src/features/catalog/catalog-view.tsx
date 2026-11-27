import { useDeferredValue, useMemo, useState } from 'react';
import { ListChecks, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BLOCK_ORDER, BLOCKS, ELECTIVE_LABELS } from '@/domain/curriculum';
import type { CourseState } from '@/domain/progress';
import type { BlockId, Course } from '@/domain/types';
import { cn } from '@/lib/utils';
import { useAcademic, useDataset, useStudent } from '@/state/app-state';
import { useOpenCourse } from '../course/course-detail';
import { RetakeBadge, StatusBadge } from '../shared/controls';
import { lastGrade, termLabel } from '../shared/labels';
import { TermGradesDialog } from './term-grades-dialog';

type StatusFilter = 'all' | 'available' | 'enrolled' | 'passed' | 'blocked' | 'retake';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'Todas' },
  { value: 'available', label: 'Disponibles' },
  { value: 'enrolled', label: 'Cursando' },
  { value: 'retake', label: 'Por repetir' },
  { value: 'passed', label: 'Aprobadas' },
  { value: 'blocked', label: 'Bloqueadas' },
];

interface CourseGroup {
  key: string;
  title: string;
  subtitle: string;
  courses: Course[];
  /** Se puede cargar notas en lote (cuatrimestres con obligatorias). */
  bulk: boolean;
}

/** Cuatrimestres de cada bloque en orden y, al final del bloque, su grupo de electivas. */
function buildGroups(courses: Course[]): CourseGroup[] {
  const groups: CourseGroup[] = [];
  for (const block of BLOCK_ORDER) {
    const inBlock = courses.filter((c) => c.block === block);
    const terms = [...new Set(inBlock.filter((c) => c.term !== null).map((c) => c.term!))].sort((a, b) => a - b);
    for (const term of terms) {
      groups.push({
        key: `${block}-${term}`,
        title: block === 'PROYECTO_GRADO' ? BLOCKS[block].label : termLabel(term),
        subtitle: BLOCKS[block].label,
        courses: inBlock.filter((c) => c.term === term && c.elective === null),
        bulk: true,
      });
    }
    const rule = BLOCKS[block].electives;
    if (rule) {
      groups.push({
        key: `${block}-electivas`,
        title: ELECTIVE_LABELS[rule.group],
        subtitle: `Elegí ${rule.credits} créditos durante ${BLOCKS[block].label}`,
        courses: inBlock.filter((c) => c.elective === rule.group),
        bulk: false,
      });
    }
  }
  return groups;
}

function matchesStatus(state: CourseState, filter: StatusFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'retake') return state.status !== 'passed' && state.failedAttempts > 0;
  return state.status === filter;
}

export function CatalogView() {
  const { courses } = useDataset();
  const { snapshot } = useAcademic();
  const { data } = useStudent();
  const openCourse = useOpenCourse();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [block, setBlock] = useState<BlockId | 'all'>('all');
  const [bulkGroup, setBulkGroup] = useState<CourseGroup | null>(null);
  const deferredQuery = useDeferredValue(query);

  const groups = useMemo(() => buildGroups(courses), [courses]);
  const planned = useMemo(() => new Set(data.plan.items.map((i) => i.courseId)), [data.plan.items]);

  const visibleGroups = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
    const nq = normalize(q);
    return groups
      .filter((g) => block === 'all' || g.courses[0]?.block === block)
      .map((g) => ({
        ...g,
        courses: g.courses.filter(
          (c) =>
            matchesStatus(snapshot.courses.get(c.id)!, status) &&
            (nq === '' || normalize(c.id).includes(nq) || normalize(c.name).includes(nq)),
        ),
      }))
      .filter((g) => g.courses.length > 0);
  }, [groups, snapshot, status, block, deferredQuery]);

  const visibleCount = visibleGroups.reduce((sum, g) => sum + g.courses.length, 0);

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar clave o nombre"
            aria-label="Buscar materia"
            className="h-11 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={status === f.value}
                onClick={() => setStatus(f.value)}
                className={cn(
                  'min-h-9 rounded-full border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  status === f.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <Select value={block} onValueChange={(v) => setBlock(v as BlockId | 'all')}>
            <SelectTrigger className="h-9 w-auto min-w-44" aria-label="Filtrar por bloque">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los bloques</SelectItem>
              {BLOCK_ORDER.map((b) => (
                <SelectItem key={b} value={b}>
                  {BLOCKS[b].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {visibleCount} materias
        </p>
      </div>

      {visibleGroups.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          Ninguna materia coincide con los filtros.
        </p>
      )}

      {visibleGroups.map((group) => {
        const all = groups.find((g) => g.key === group.key)!.courses;
        const passedCount = all.filter((c) => snapshot.courses.get(c.id)?.status === 'passed').length;
        const pending = all.filter((c) => snapshot.courses.get(c.id)?.status !== 'passed');
        return (
          <section key={group.key} aria-labelledby={`h-${group.key}`} className="space-y-3">
            <header className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
              <div className="min-w-0">
                <h2 id={`h-${group.key}`} className="font-semibold">
                  {group.title}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  {group.subtitle} · {all.reduce((s, c) => s + c.credits, 0)} cr · {passedCount}/{all.length} aprobadas
                </p>
              </div>
              {group.bulk && pending.length > 0 && (
                <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setBulkGroup({ ...group, courses: pending })}>
                  <ListChecks /> Cargar notas
                </Button>
              )}
            </header>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {group.courses.map((course) => (
                <li key={course.id}>
                  <CourseCard
                    course={course}
                    state={snapshot.courses.get(course.id)!}
                    planned={planned.has(course.id)}
                    onOpen={() => openCourse(course.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {bulkGroup && (
        <TermGradesDialog
          open
          onOpenChange={(open) => !open && setBulkGroup(null)}
          title={`Cargar notas · ${bulkGroup.title}`}
          description="Elegí la nota de cada materia que ya cursaste. Las que dejes en “Sin cambios” no se modifican."
          courses={bulkGroup.courses}
        />
      )}
    </div>
  );
}

function CourseCard({
  course,
  state,
  planned,
  onOpen,
}: {
  course: Course;
  state: CourseState;
  planned: boolean;
  onOpen: () => void;
}) {
  const grade = lastGrade(state);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex h-full w-full flex-col gap-2 rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        state.status === 'blocked' && 'opacity-70',
        state.status === 'passed' && 'border-emerald-500/30',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-sm text-primary">{course.id}</span>
        <StatusBadge status={state.status} />
      </div>
      <p className="font-medium leading-snug">{course.name}</p>
      <div className="mt-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{course.credits} cr</span>
        {grade && <span className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">Nota {grade}</span>}
        {planned && <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-violet-200">En el plan</span>}
        <RetakeBadge count={state.status === 'passed' ? 0 : state.failedAttempts} />
      </div>
    </button>
  );
}
