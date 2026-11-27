import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatPeriod, nextPeriod, periodOf, recentPeriods } from '@/domain/period';
import type { CourseStatus } from '@/domain/progress';
import { LETTER_GRADES, type LetterGrade } from '@/domain/types';
import { cn } from '@/lib/utils';
import { GRADE_LABEL, STATUS_LABEL } from './labels';

const STATUS_CLASS: Record<CourseStatus, string> = {
  passed: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
  enrolled: 'border-violet-400/40 bg-violet-500/15 text-violet-200',
  available: 'border-sky-400/40 bg-sky-500/15 text-sky-200',
  blocked: 'border-border bg-muted text-muted-foreground',
};

export function StatusBadge({ status, className }: { status: CourseStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('whitespace-nowrap font-medium', STATUS_CLASS[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function RetakeBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Badge variant="outline" className="whitespace-nowrap border-amber-400/40 bg-amber-500/15 text-amber-200">
      {count === 1 ? 'Reprobada 1 vez' : `Reprobada ${count} veces`}
    </Badge>
  );
}

/** "AP" = aprobada sin nota registrada (no cuenta en el índice). */
export type GradeChoice = LetterGrade | 'AP';
export const toAttemptGrade = (choice: GradeChoice): LetterGrade | null => (choice === 'AP' ? null : choice);

export function GradeSelect({
  value,
  onChange,
  id,
  placeholder = 'Calificación',
  allowUngraded = true,
  className,
}: {
  value: GradeChoice | undefined;
  onChange: (value: GradeChoice) => void;
  id?: string;
  placeholder?: string;
  allowUngraded?: boolean;
  className?: string;
}) {
  return (
    <Select value={value ?? ''} onValueChange={(v) => onChange(v as GradeChoice)}>
      <SelectTrigger id={id} className={cn('h-11', className)} aria-label={placeholder}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {LETTER_GRADES.map((grade) => (
          <SelectItem key={grade} value={grade}>
            {GRADE_LABEL[grade]}
          </SelectItem>
        ))}
        {allowUngraded && <SelectItem value="AP">Aprobada, no recuerdo la nota</SelectItem>}
      </SelectContent>
    </Select>
  );
}

/** Opciones de cuatrimestre: el próximo, el actual y los últimos años, o "sin indicar". */
export function PeriodSelect({
  value,
  onChange,
  id,
  includeNext = false,
  allowNone = true,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  id?: string;
  includeNext?: boolean;
  allowNone?: boolean;
}) {
  const now = periodOf(new Date());
  const options = [...(includeNext ? [nextPeriod(now)] : []), ...recentPeriods(now, 22)];
  return (
    <Select value={value ?? 'none'} onValueChange={(v) => onChange(v === 'none' ? null : v)}>
      <SelectTrigger id={id} className="h-11" aria-label="Cuatrimestre">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {allowNone && <SelectItem value="none">Sin indicar</SelectItem>}
        {options.map((period) => (
          <SelectItem key={period} value={period}>
            {formatPeriod(period)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
