import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import type { Course } from '@/domain/types';
import { toast } from '@/hooks/use-toast';
import { useStudent } from '@/state/app-state';
import { GradeSelect, PeriodSelect, toAttemptGrade, type GradeChoice } from '../shared/controls';

/**
 * Carga de notas de varias materias a la vez: sirve tanto para cargar el
 * historial al empezar a usar la app como para cerrar un cuatrimestre.
 * Las materias sin calificación elegida no se tocan.
 */
export function TermGradesDialog({
  open,
  onOpenChange,
  title,
  description,
  courses,
  defaultPeriod = null,
  onDrop,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  courses: Course[];
  defaultPeriod?: string | null;
  /** Si se pasa, cada materia ofrece "Retirada" (sale de "cursando" sin nota). */
  onDrop?: (courseId: string) => void;
}) {
  const { dispatch } = useStudent();
  const [grades, setGrades] = useState<Record<string, GradeChoice | 'DROP'>>({});
  const [period, setPeriod] = useState<string | null>(defaultPeriod);

  const chosen = Object.entries(grades);
  const save = () => {
    const entries = chosen
      .filter(([, grade]) => grade !== 'DROP')
      .map(([courseId, grade]) => ({ courseId, attempt: { grade: toAttemptGrade(grade as GradeChoice), period } }));
    if (entries.length > 0) dispatch({ type: 'recordAttempts', entries });
    chosen.filter(([, grade]) => grade === 'DROP').forEach(([courseId]) => onDrop?.(courseId));
    toast({ title: `${chosen.length} materia(s) actualizada(s)` });
    setGrades({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1">
          <Label htmlFor="bulk-period">Cuatrimestre en que las cursaste</Label>
          <PeriodSelect id="bulk-period" value={period} onChange={setPeriod} />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3">
          <span className="text-sm">Poner la misma nota a todas</span>
          <GradeSelect
            className="w-40"
            value={undefined}
            placeholder="Elegir…"
            onChange={(grade) => setGrades(Object.fromEntries(courses.map((c) => [c.id, grade])))}
          />
        </div>

        <ul className="divide-y divide-border">
          {courses.map((course) => (
            <li key={course.id} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="font-mono text-xs text-primary">{course.id}</p>
                <p className="truncate text-sm">{course.name}</p>
              </div>
              {onDrop ? (
                <DropAwareGradeSelect
                  value={grades[course.id]}
                  onChange={(grade) => setGrades((g) => ({ ...g, [course.id]: grade }))}
                />
              ) : (
                <GradeSelect
                  className="w-40 shrink-0"
                  placeholder="Sin cambios"
                  value={grades[course.id] as GradeChoice | undefined}
                  onChange={(grade) => setGrades((g) => ({ ...g, [course.id]: grade }))}
                />
              )}
            </li>
          ))}
        </ul>

        <DialogFooter className="gap-2">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="h-11" disabled={chosen.length === 0} onClick={save}>
            Guardar {chosen.length > 0 ? `(${chosen.length})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DropAwareGradeSelect({
  value,
  onChange,
}: {
  value: GradeChoice | 'DROP' | undefined;
  onChange: (value: GradeChoice | 'DROP') => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <GradeSelect
        className="w-32"
        placeholder={value === 'DROP' ? 'Retirada' : 'Sin cambios'}
        allowUngraded={false}
        value={value === 'DROP' ? undefined : value}
        onChange={onChange}
      />
      <Button
        variant={value === 'DROP' ? 'secondary' : 'ghost'}
        className="h-11 px-2 text-xs"
        onClick={() => onChange('DROP')}
        aria-pressed={value === 'DROP'}
      >
        Retiré
      </Button>
    </div>
  );
}
