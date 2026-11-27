import { describe, expect, it } from 'vitest';
import { parseScheduleLabel } from './build-sections.mjs';

const at = (day, start, end) => ({ day, start, end });

describe('parseScheduleLabel', () => {
  it('rango con sufijo al final', () => {
    expect(parseScheduleLabel('J1:45 a 4:00 pm (Presencial)')).toEqual([at(4, '13:45', '16:00')]);
    expect(parseScheduleLabel('J10:45 a 1:00 pm (Presencial)')).toEqual([at(4, '10:45', '13:00')]);
  });

  it('"12:15 am" del export es mediodía', () => {
    expect(parseScheduleLabel('L10:00 a 12:15 am (Presencial)')).toEqual([at(1, '10:00', '12:15')]);
  });

  it('lista de bloques de 45 minutos', () => {
    expect(parseScheduleLabel('V4:00,4:45 pm (Presencial)')).toEqual([at(5, '16:00', '17:30')]);
    expect(parseScheduleLabel('MI11:30,12:15 pm (Presencial)')).toEqual([at(3, '11:30', '13:00')]);
  });

  it('varios días con el mismo horario, incluidos MA y MI', () => {
    expect(parseScheduleLabel('MAJ7:00,7:45 pm (Presencial)')).toEqual([at(2, '19:00', '20:30'), at(4, '19:00', '20:30')]);
    expect(parseScheduleLabel('LMI9:15 a 11:30 am (Presencial)')).toEqual([at(1, '09:15', '11:30'), at(3, '09:15', '11:30')]);
  });

  it('grupos con sufijos distintos, heredados hacia atrás', () => {
    expect(parseScheduleLabel('L1:00,1:45 pm,J8:30,9:15 am (Presencial)')).toEqual([
      at(1, '13:00', '14:30'),
      at(4, '08:30', '10:00'),
    ]);
    expect(parseScheduleLabel('L2:30,3:15,MI2:30,3:15 pm (Presencial)')).toEqual([
      at(1, '14:30', '16:00'),
      at(3, '14:30', '16:00'),
    ]);
  });

  it('acepta punto como separador, PM en mayúscula y etiquetas sin sufijo', () => {
    expect(parseScheduleLabel('MA5.30,6.15 PM (Presencial)')).toEqual([at(2, '17:30', '19:00')]);
    expect(parseScheduleLabel('S8:00 a 10:15 (Presencial)')).toEqual([at(6, '08:00', '10:15')]);
  });

  it('rechaza formatos desconocidos en vez de inventar un horario', () => {
    expect(() => parseScheduleLabel('X9:00 a 10:00 am')).toThrow();
  });
});
