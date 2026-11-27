import { toMinutes, WEEKDAY_SHORT, WEEKDAYS, formatTime } from '@/domain/schedule';
import type { Section } from '@/domain/types';
import { cn } from '@/lib/utils';

export interface GridEntry {
  courseId: string;
  name: string;
  section: Section | undefined;
  conflicted: boolean;
}

const PX_PER_HOUR = 44;
const PALETTE = [
  'bg-sky-500/25 border-sky-400/60',
  'bg-emerald-500/25 border-emerald-400/60',
  'bg-violet-500/25 border-violet-400/60',
  'bg-amber-500/25 border-amber-400/60',
  'bg-pink-500/25 border-pink-400/60',
  'bg-teal-500/25 border-teal-400/60',
  'bg-indigo-500/25 border-indigo-400/60',
  'bg-lime-500/25 border-lime-400/60',
];

/**
 * Horario semanal (lunes a sábado). El rango de horas se ajusta a lo que hay
 * en el plan para no mostrar 15 filas vacías en un celular.
 */
export function WeekGrid({ entries }: { entries: GridEntry[] }) {
  const scheduled = entries.filter((e) => e.section && e.section.meetings.length > 0);
  const unscheduled = entries.filter((e) => !e.section || e.section.meetings.length === 0);

  const meetings = scheduled.flatMap((e) => e.section!.meetings);
  const startHour = meetings.length ? Math.floor(Math.min(...meetings.map((m) => toMinutes(m.start))) / 60) : 7;
  const endHour = meetings.length ? Math.ceil(Math.max(...meetings.map((m) => toMinutes(m.end))) / 60) : 13;
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const height = (endHour - startHour) * PX_PER_HOUR;
  const colorOf = (courseId: string) => PALETTE[entries.findIndex((e) => e.courseId === courseId) % PALETTE.length];

  return (
    <div className="space-y-3">
      {/* Representación visual; la misma información está en texto en la lista del plan. */}
      <div className="overflow-x-auto rounded-lg border border-border" aria-hidden="true">
        <div className="grid min-w-[480px] grid-cols-[2.5rem_repeat(6,minmax(0,1fr))]">
          <div className="contents">
            <div className="border-b border-border" />
            {WEEKDAYS.map((day) => (
              <div key={day} className="border-b border-l border-border py-1.5 text-center text-xs font-semibold">
                {WEEKDAY_SHORT[day]}
              </div>
            ))}
          </div>
          <div className="relative" style={{ height }}>
            {hours.map((h) => (
              <span key={h} className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: (h - startHour) * PX_PER_HOUR }}>
                {h > 12 ? h - 12 : h}
                {h >= 12 ? 'p' : 'a'}
              </span>
            ))}
          </div>
          {WEEKDAYS.map((day) => (
            <div key={day} className="relative border-l border-border" style={{ height }}>
              {hours.map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-border/50" style={{ top: (h - startHour) * PX_PER_HOUR }} />
              ))}
              {scheduled.flatMap((entry) =>
                entry.section!.meetings
                  .filter((m) => m.day === day)
                  .map((m) => {
                    const top = ((toMinutes(m.start) - startHour * 60) / 60) * PX_PER_HOUR;
                    const blockHeight = ((toMinutes(m.end) - toMinutes(m.start)) / 60) * PX_PER_HOUR;
                    return (
                      <div
                        key={`${entry.courseId}-${m.start}`}
                        title={`${entry.name} · ${formatTime(m.start)}–${formatTime(m.end)}`}
                        className={cn(
                          'absolute inset-x-0.5 overflow-hidden rounded border px-1 py-0.5 text-[10px] leading-tight',
                          colorOf(entry.courseId),
                          entry.conflicted && 'border-2 border-destructive bg-destructive/40',
                        )}
                        style={{ top, height: blockHeight }}
                      >
                        <span className="block font-mono font-semibold">{entry.courseId}</span>
                        <span className="block opacity-80">{formatTime(m.start).replace(/ [ap]\. m\./, '')}</span>
                      </div>
                    );
                  }),
              )}
            </div>
          ))}
        </div>
      </div>
      {unscheduled.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Sin horario fijo en la grilla: {unscheduled.map((e) => e.courseId).join(', ')} (sin sección elegida, virtual o práctica
          en hospital).
        </p>
      )}
    </div>
  );
}
