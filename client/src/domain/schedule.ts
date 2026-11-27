import type { Meeting, Section, Weekday } from './types';

export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6];
export const WEEKDAY_SHORT: Record<Weekday, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie', 6: 'Sáb' };

export const toMinutes = (hhmm: string): number => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};

/** Intervalos semiabiertos: una clase que termina 10:00 no choca con otra que empieza 10:00. */
export const meetingsOverlap = (a: Meeting, b: Meeting): boolean =>
  a.day === b.day && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end);

export const sectionsConflict = (a: Section, b: Section): boolean =>
  a.meetings.some((ma) => b.meetings.some((mb) => meetingsOverlap(ma, mb)));

export interface ScheduleConflict {
  courseA: string;
  courseB: string;
  day: Weekday;
  start: string;
  end: string;
}

/** Todos los pares de materias cuyas secciones elegidas se pisan, con el tramo exacto. */
export function findConflicts(entries: ReadonlyArray<{ courseId: string; section: Section }>): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      for (const ma of entries[i].section.meetings) {
        for (const mb of entries[j].section.meetings) {
          if (!meetingsOverlap(ma, mb)) continue;
          conflicts.push({
            courseA: entries[i].courseId,
            courseB: entries[j].courseId,
            day: ma.day,
            start: toMinutes(ma.start) > toMinutes(mb.start) ? ma.start : mb.start,
            end: toMinutes(ma.end) < toMinutes(mb.end) ? ma.end : mb.end,
          });
        }
      }
    }
  }
  return conflicts;
}

/** "13:45" → "1:45 p. m." */
export function formatTime(hhmm: string): string {
  const minutes = toMinutes(hhmm);
  const hours24 = Math.floor(minutes / 60);
  const hours12 = hours24 % 12 || 12;
  return `${hours12}:${String(minutes % 60).padStart(2, '0')} ${hours24 < 12 ? 'a. m.' : 'p. m.'}`;
}

export const formatMeeting = (m: Meeting): string =>
  `${WEEKDAY_SHORT[m.day]} ${formatTime(m.start)}–${formatTime(m.end)}`;

export function describeSection(section: Section): string {
  if (section.modality === 'hospital') return `Práctica en ${section.room}`;
  if (section.meetings.length === 0) return 'Virtual, sin horario fijo';
  const when = section.meetings.map(formatMeeting).join(' · ');
  return section.modality === 'virtual' ? `${when} (virtual)` : when;
}
