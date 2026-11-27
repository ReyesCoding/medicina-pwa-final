/**
 * Cuatrimestres de UTESA como "AAAA-N": 1 = enero–abril, 2 = mayo–agosto,
 * 3 = septiembre–diciembre. El formato ordena bien como texto.
 */
const PERIOD_RE = /^(\d{4})-([123])$/;
const PERIOD_LABELS = ['Ene–Abr', 'May–Ago', 'Sep–Dic'] as const;

export const isPeriod = (value: string): boolean => PERIOD_RE.test(value);

export function periodOf(date: Date): string {
  return `${date.getFullYear()}-${Math.floor(date.getMonth() / 4) + 1}`;
}

export function nextPeriod(period: string): string {
  const [year, term] = parse(period);
  return term === 3 ? `${year + 1}-1` : `${year}-${term + 1}`;
}

export function previousPeriod(period: string): string {
  const [year, term] = parse(period);
  return term === 1 ? `${year - 1}-3` : `${year}-${term - 1}`;
}

export function formatPeriod(period: string): string {
  const [year, term] = parse(period);
  return `${PERIOD_LABELS[term - 1]} ${year}`;
}

/** Últimos `count` cuatrimestres hasta `upTo` inclusive, del más reciente al más viejo. */
export function recentPeriods(upTo: string, count: number): string[] {
  const out = [upTo];
  while (out.length < count) out.push(previousPeriod(out[out.length - 1]));
  return out;
}

function parse(period: string): [number, number] {
  const match = PERIOD_RE.exec(period);
  if (!match) throw new Error(`Período inválido: "${period}"`);
  return [Number(match[1]), Number(match[2])];
}

/**
 * Cuatrimestre por defecto al inscribir: en la segunda mitad de un
 * cuatrimestre lo normal es estar inscribiendo el siguiente.
 */
export function enrollmentPeriodFor(date: Date): string {
  const current = periodOf(date);
  return date.getMonth() % 4 >= 2 ? nextPeriod(current) : current;
}
