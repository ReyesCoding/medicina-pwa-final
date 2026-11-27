import { describe, expect, it } from 'vitest';
import { enrollmentPeriodFor, formatPeriod, isPeriod, nextPeriod, periodOf, previousPeriod, recentPeriods } from '../period';
import { describeSection, formatTime, meetingsOverlap } from '../schedule';
import { section } from './fixtures';

describe('meetingsOverlap', () => {
  const mon = (start: string, end: string) => ({ day: 1 as const, start, end });

  it('detecta solapes parciales y contenidos', () => {
    expect(meetingsOverlap(mon('08:00', '10:15'), mon('09:00', '11:00'))).toBe(true);
    expect(meetingsOverlap(mon('08:00', '12:00'), mon('09:00', '10:00'))).toBe(true);
  });

  it('una clase que termina cuando empieza otra no choca', () => {
    expect(meetingsOverlap(mon('08:00', '10:00'), mon('10:00', '11:00'))).toBe(false);
  });

  it('días distintos nunca chocan', () => {
    expect(meetingsOverlap(mon('08:00', '10:00'), { day: 2, start: '08:00', end: '10:00' })).toBe(false);
  });
});

describe('formato de horarios', () => {
  it('usa 12 h con mediodía correcto', () => {
    expect(formatTime('13:45')).toBe('1:45 p. m.');
    expect(formatTime('12:15')).toBe('12:15 p. m.');
    expect(formatTime('07:00')).toBe('7:00 a. m.');
  });

  it('describe secciones sin horario fijo', () => {
    expect(describeSection({ ...section('X', '1'), modality: 'hospital', room: 'Hosp. Cabral y Báez' })).toBe(
      'Práctica en Hosp. Cabral y Báez',
    );
    expect(describeSection({ ...section('X', '1'), modality: 'virtual' })).toBe('Virtual, sin horario fijo');
  });
});

describe('períodos', () => {
  it('mapea meses a cuatrimestres de UTESA', () => {
    expect(periodOf(new Date(2026, 0, 15))).toBe('2026-1');
    expect(periodOf(new Date(2026, 4, 1))).toBe('2026-2');
    expect(periodOf(new Date(2026, 10, 27))).toBe('2026-3');
  });

  it('avanza y retrocede cruzando el año', () => {
    expect(nextPeriod('2026-3')).toBe('2027-1');
    expect(previousPeriod('2027-1')).toBe('2026-3');
    expect(recentPeriods('2027-1', 3)).toEqual(['2027-1', '2026-3', '2026-2']);
  });

  it('formatea y valida', () => {
    expect(formatPeriod('2026-3')).toBe('Sep–Dic 2026');
    expect(isPeriod('2026-4')).toBe(false);
    expect(() => formatPeriod('x')).toThrow();
  });

  it('al inscribir sugiere el cuatrimestre siguiente si el actual ya va por la mitad', () => {
    expect(enrollmentPeriodFor(new Date(2027, 0, 8))).toBe('2027-1');
    expect(enrollmentPeriodFor(new Date(2026, 10, 27))).toBe('2027-1');
  });
});
