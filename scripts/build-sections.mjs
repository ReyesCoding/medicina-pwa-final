#!/usr/bin/env node
/**
 * Genera client/public/data/sections.json a partir del export crudo de la
 * oferta académica (docs/sections.txt, separado por tabs).
 *
 * Por qué existe: el export de la universidad trae los horarios como texto
 * libre ("MA9:15,10:00 am", "L10:00 a 12:15 am", "Hosp. ..."), con más de
 * cien variantes de formato. Parsearlo en el navegador sería frágil y lento;
 * hacerlo una vez acá deja un JSON normalizado que los tests validan.
 *
 * Uso: npm run data:sections
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RAW_FILE = path.join(ROOT, 'docs/sections.txt');
const COURSES_FILE = path.join(ROOT, 'client/public/data/courses.json');
const OUT_FILE = path.join(ROOT, 'client/public/data/sections.json');

/** Duración de una hora académica en UTESA (los horarios "a,b" listan bloques de 45 min). */
const ACADEMIC_HOUR_MIN = 45;

/** Lun=1 … Sáb=6. Los códigos de dos letras se prueban antes que los de una. */
const DAY_CODES = [
  ['MA', 2],
  ['MI', 3],
  ['L', 1],
  ['J', 4],
  ['V', 5],
  ['S', 6],
];

const toHHMM = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function parseDays(code) {
  const days = [];
  let rest = code;
  while (rest.length > 0) {
    const match = DAY_CODES.find(([prefix]) => rest.startsWith(prefix));
    if (!match) throw new Error(`Código de día desconocido en "${code}"`);
    days.push(match[1]);
    rest = rest.slice(match[0].length);
  }
  return days;
}

/** Minutos desde medianoche para la hora "ancla" de un grupo, usando su sufijo. */
function resolveAnchor(h, m, suffix) {
  if (h === 12) return 12 * 60 + m; // "12:15 am" en el export significa mediodía: no hay clases de madrugada.
  if (suffix === 'pm') return (h + 12) * 60 + m;
  if (suffix === 'am') return h * 60 + m;
  // Sin sufijo: las clases van de 7:00 a 22:00, así que 1–6 sólo puede ser de tarde.
  return (h < 7 ? h + 12 : h) * 60 + m;
}

/** La interpretación (am o pm) más tardía que siga siendo anterior a `before`. */
function resolveBefore(h, m, before) {
  const candidates = h === 12 ? [12 * 60 + m] : [h * 60 + m, (h + 12) * 60 + m];
  const valid = candidates.filter((c) => c < before);
  if (valid.length === 0) throw new Error(`Hora ${h}:${m} no puede ir antes de ${toHHMM(before)}`);
  return Math.max(...valid);
}

/**
 * Convierte una etiqueta de horario en reuniones semanales.
 * Gramática observada: grupos separados por coma; cada grupo empieza con
 * códigos de día y lleva un rango "h:m a h:m" o una lista de bloques de 45 min
 * "h:m,h:m"; el sufijo am/pm de un grupo, si falta, lo hereda del siguiente.
 */
export function parseScheduleLabel(label) {
  const body = label
    .replace(/\s*\((Presencial|Virtual)\)\s*$/i, '')
    .replace(/(\d+)\.(\d{2})/g, '$1:$2')
    .trim();

  const groups = [];
  for (const token of body.split(',').map((t) => t.trim())) {
    const start = token.match(/^([A-Z]+)(.*)$/);
    if (start) groups.push({ days: parseDays(start[1]), parts: [start[2].trim()] });
    else if (groups.length > 0) groups[groups.length - 1].parts.push(token);
    else throw new Error(`Etiqueta sin día: "${label}"`);
  }

  // Extrae sufijos y propaga hacia atrás a los grupos que no lo declaran.
  for (const group of groups) {
    const last = group.parts[group.parts.length - 1];
    const suffix = last.match(/\s*(am|pm)$/i);
    group.suffix = suffix ? suffix[1].toLowerCase() : null;
    group.parts[group.parts.length - 1] = last.replace(/\s*(am|pm)$/i, '');
  }
  for (let i = groups.length - 2; i >= 0; i--) groups[i].suffix ??= groups[i + 1].suffix;

  const meetings = [];
  for (const group of groups) {
    const times = [];
    let explicitEnd = null;
    for (const part of group.parts) {
      const range = part.match(/^(\d{1,2}):(\d{2})\s+a\s+(\d{1,2}):(\d{2})$/);
      const single = part.match(/^(\d{1,2}):(\d{2})$/);
      if (range) {
        times.push([+range[1], +range[2]]);
        explicitEnd = [+range[3], +range[4]];
      } else if (single) {
        times.push([+single[1], +single[2]]);
      } else {
        throw new Error(`Fragmento de hora no reconocido "${part}" en "${label}"`);
      }
    }

    let end;
    let starts;
    if (explicitEnd) {
      end = resolveAnchor(explicitEnd[0], explicitEnd[1], group.suffix);
      starts = [resolveBefore(times[0][0], times[0][1], end)];
    } else {
      // Lista de bloques: el último se resuelve con el sufijo y los anteriores hacia atrás.
      starts = new Array(times.length);
      starts[times.length - 1] = resolveAnchor(...times[times.length - 1], group.suffix);
      for (let i = times.length - 2; i >= 0; i--) starts[i] = resolveBefore(...times[i], starts[i + 1]);
      end = starts[starts.length - 1] + ACADEMIC_HOUR_MIN;
    }

    // Bloques contiguos forman una sola reunión; un hueco abre otra.
    const spans = [];
    for (let i = 0; i < starts.length; i++) {
      const spanEnd = explicitEnd ? end : starts[i] + ACADEMIC_HOUR_MIN;
      const previous = spans[spans.length - 1];
      if (previous && previous.end === starts[i]) previous.end = spanEnd;
      else spans.push({ start: starts[i], end: spanEnd });
    }

    for (const day of group.days) {
      for (const span of spans) meetings.push({ day, start: toHHMM(span.start), end: toHHMM(span.end) });
    }
  }
  return meetings.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
}

/** "MED100001" → "MED-100" */
const courseIdFromCrn = (crn) => `${crn.slice(0, 3)}-${crn.slice(3, 6)}`;

function buildSection([crn, , label, room = '']) {
  const base = { crn, courseId: courseIdFromCrn(crn), room: room.trim() };
  if (/^Asig\. Virtual/i.test(label)) return { ...base, modality: 'virtual', meetings: [] };
  if (!/^[LMJVS]{1,2}[A-Z]*\d/.test(label)) {
    // Prácticas en hospital: el export trae el centro en lugar del horario.
    return { ...base, room: label.replace(/\s*\(Presencial\)\s*$/i, ''), modality: 'hospital', meetings: [] };
  }
  const modality = /\(Virtual\)/i.test(label) ? 'virtual' : 'presencial';
  return { ...base, modality, meetings: parseScheduleLabel(label) };
}

function main() {
  const courseIds = new Set(JSON.parse(readFileSync(COURSES_FILE, 'utf8')).map((c) => c.id));
  const rows = readFileSync(RAW_FILE, 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split('\t'));

  const sections = rows
    .map(buildSection)
    // El export incluye la oferta de otras carreras; sólo se publican las del pensum.
    .filter((section) => courseIds.has(section.courseId))
    .sort((a, b) => a.courseId.localeCompare(b.courseId) || a.crn.localeCompare(b.crn));

  writeFileSync(OUT_FILE, `${JSON.stringify(sections)}\n`);
  console.log(`sections.json: ${sections.length} secciones de ${rows.length} filas del export.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
