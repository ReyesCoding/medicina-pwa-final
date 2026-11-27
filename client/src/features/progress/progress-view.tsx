import type { ReactNode } from 'react';
import { CheckCircle2, CircleDashed, Lock } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { BLOCK_ORDER, BLOCKS, ELECTIVE_LABELS } from '@/domain/curriculum';
import { formatGpa, gpaByPeriod } from '@/domain/grades';
import { formatPeriod } from '@/domain/period';
import type { BlockStatus, ProgressSnapshot } from '@/domain/progress';
import type { BlockId, Course } from '@/domain/types';
import { cn } from '@/lib/utils';
import { useAcademic, useDataset, useStudent } from '@/state/app-state';
import { useOpenCourse } from '../course/course-detail';
import { describeGap } from '../shared/labels';

export function ProgressView() {
  const { courses, coursesById } = useDataset();
  const { data } = useStudent();
  const { snapshot } = useAcademic();
  const byPeriod = gpaByPeriod(data.history, (id) => coursesById.get(id)?.credits ?? 0);
  const states = [...snapshot.courses.values()];
  const passedCount = states.filter((s) => s.status === 'passed').length;
  const retakeCount = states.filter((s) => s.status !== 'passed' && s.failedAttempts > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Índice acumulado" value={formatGpa(snapshot.gpa.value)} hint={gpaHint(snapshot)} />
        <Kpi
          label="Materias aprobadas"
          value={String(passedCount)}
          hint={retakeCount > 0 ? `${retakeCount} por repetir` : 'Ninguna pendiente de repetir'}
        />
        <Kpi
          className="col-span-2 sm:col-span-1"
          label="Créditos para el título"
          value={`${snapshot.degreeCredits} / ${snapshot.totalCredits}`}
          hint={`${Math.floor((snapshot.degreeCredits / snapshot.totalCredits) * 100)}% de la carrera`}
        >
          <Progress value={(snapshot.degreeCredits / snapshot.totalCredits) * 100} aria-label="Avance de la carrera" />
        </Kpi>
      </div>

      <NextGate snapshot={snapshot} />

      <section aria-labelledby="blocks-title" className="space-y-3">
        <h2 id="blocks-title" className="text-lg font-semibold">
          Bloques del pensum
        </h2>
        <ul className="grid gap-3 md:grid-cols-2">
          {BLOCK_ORDER.map((id) => (
            <BlockCard key={id} block={snapshot.blocks[id]} hasWorkable={hasWorkableCourse(snapshot, courses, id)} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="periods-title" className="space-y-3">
        <h2 id="periods-title" className="text-lg font-semibold">
          Índice por cuatrimestre
        </h2>
        {byPeriod.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aparece cuando registrás notas indicando el cuatrimestre en que cursaste cada materia.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Cuatrimestre</th>
                <th className="py-2 text-right font-medium">Créditos con nota</th>
                <th className="py-2 text-right font-medium">Índice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {byPeriod.map((row) => (
                <tr key={row.period}>
                  <td className="py-2">{formatPeriod(row.period)}</td>
                  <td className="py-2 text-right">{row.gradedCredits}</td>
                  <td className="py-2 text-right font-semibold">{formatGpa(row.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function gpaHint(snapshot: ProgressSnapshot): string {
  if (snapshot.gpa.value === null) return 'Registrá notas para calcularlo';
  const base = `${snapshot.gpa.gradedCredits} créditos con nota`;
  return snapshot.ungradedPassed > 0 ? `${base} · ${snapshot.ungradedPassed} aprobadas sin nota no cuentan` : base;
}

function Kpi({
  label,
  value,
  hint,
  children,
  className,
}: {
  label: string;
  value: string;
  hint: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1.5 rounded-lg border border-border bg-card p-3 sm:p-4', className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/** La próxima puerta de bloque que el estudiante todavía no cruzó, con lo que le falta. */
function NextGate({ snapshot }: { snapshot: ProgressSnapshot }) {
  const openCourse = useOpenCourse();
  const next = BLOCK_ORDER.find((id) => BLOCKS[id].requiresBlock && !snapshot.blocks[id].entry.entered);
  if (!next) return null;
  const target = snapshot.blocks[next];
  const previous = snapshot.blocks[BLOCKS[next].requiresBlock!];
  const rule = BLOCKS[next];

  const checks: Array<{ ok: boolean; text: string }> = [
    {
      ok: previous.missingMandatory.length === 0,
      text:
        previous.missingMandatory.length === 0
          ? `Obligatorias de ${BLOCKS[previous.id].label} aprobadas`
          : `Te faltan ${previous.missingMandatory.length} obligatorias de ${BLOCKS[previous.id].label}`,
    },
  ];
  if (previous.elective) {
    const { earned, required, group } = previous.elective;
    checks.push({ ok: earned >= required, text: `${ELECTIVE_LABELS[group]}: ${Math.min(earned, required)} de ${required} créditos` });
  }
  if (rule.minGpa !== null) {
    const gap = target.entry.gaps.find((g) => g.kind === 'gpaBelow');
    checks.push({
      ok: !gap && !target.entry.gpaUnverified,
      text: gap
        ? describeGap(gap)
        : target.entry.gpaUnverified
          ? `Índice mínimo ${rule.minGpa.toFixed(1)}: registrá notas para verificarlo`
          : `Índice ${formatGpa(snapshot.gpa.value)} (mínimo ${rule.minGpa.toFixed(1)})`,
    });
  }

  return (
    <section aria-labelledby="gate-title" className={cn('space-y-3 rounded-lg border p-4', target.entry.open ? 'border-emerald-500/40' : 'border-primary/40')}>
      <h2 id="gate-title" className="text-lg font-semibold">
        {target.entry.open ? `Ya podés entrar a ${rule.label}` : `Para entrar a ${rule.label}`}
      </h2>
      <ul className="space-y-2 text-sm">
        {checks.map((check) => (
          <li key={check.text} className="flex items-start gap-2">
            {check.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" aria-label="Cumplido" />
            ) : (
              <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" aria-label="Pendiente" />
            )}
            {check.text}
          </li>
        ))}
      </ul>
      {previous.missingMandatory.length > 0 && previous.missingMandatory.length <= 12 && (
        <ul className="flex flex-wrap gap-2">
          {previous.missingMandatory.map((id) => (
            <li key={id}>
              <button
                type="button"
                onClick={() => openCourse(id)}
                className="min-h-9 rounded-full border border-border px-3 font-mono text-xs hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {id}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Hay algo que el estudiante puede cursar (o ya cursa) en el bloque. */
function hasWorkableCourse(snapshot: ProgressSnapshot, courses: readonly Course[], block: BlockId): boolean {
  return courses.some((c) => c.block === block && ['available', 'enrolled'].includes(snapshot.courses.get(c.id)!.status));
}

/**
 * "Habilitado" sólo si hay materias cursables: un bloque sin puerta (Proyecto
 * de Grado) puede tener todas sus materias bloqueadas por prerrequisitos.
 */
function BlockCard({ block, hasWorkable }: { block: BlockStatus; hasWorkable: boolean }) {
  const rule = BLOCKS[block.id];
  const state = block.complete ? 'complete' : !block.entry.open ? 'locked' : hasWorkable ? 'open' : 'pending';
  const Icon = state === 'complete' ? CheckCircle2 : state === 'open' ? CircleDashed : Lock;
  const percent = block.mandatoryCredits > 0 ? (block.passedMandatoryCredits / block.mandatoryCredits) * 100 : 0;

  return (
    <li className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{rule.label}</h3>
        <span className={cn('flex items-center gap-1 text-xs', state === 'complete' ? 'text-emerald-300' : 'text-muted-foreground')}>
          <Icon className="h-4 w-4" aria-hidden />
          {state === 'complete' ? 'Completo' : state === 'open' ? 'Habilitado' : state === 'pending' ? 'Faltan prerrequisitos' : 'Bloqueado'}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Obligatorias</span>
          <span>
            {block.passedMandatoryCredits} / {block.mandatoryCredits} cr
          </span>
        </div>
        <Progress value={percent} aria-label={`Obligatorias de ${rule.label}`} />
      </div>
      {block.elective && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{ELECTIVE_LABELS[block.elective.group]}</span>
            <span>
              {Math.min(block.elective.earned, block.elective.required)} / {block.elective.required} cr
            </span>
          </div>
          <Progress
            value={(Math.min(block.elective.earned, block.elective.required) / block.elective.required) * 100}
            aria-label={ELECTIVE_LABELS[block.elective.group]}
          />
        </div>
      )}
      {state === 'locked' && block.entry.gaps.length > 0 && (
        <ul className="list-disc pl-5 text-xs text-muted-foreground">
          {block.entry.gaps.map((gap) => (
            <li key={gap.kind}>{describeGap(gap)}</li>
          ))}
        </ul>
      )}
    </li>
  );
}
