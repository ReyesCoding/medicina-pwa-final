import { describe, expect, it } from 'vitest';
import {
  clearStudentData,
  emptyStudentData,
  LEGACY_KEYS,
  loadStudentData,
  parseBackup,
  RECOVERY_KEY,
  saveStudentData,
  serializeBackup,
  STORAGE_KEY,
  type KeyValueStore,
} from '../storage';

function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { dump: () => Record<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

describe('loadStudentData', () => {
  it('arranca vacío si no hay nada guardado', () => {
    expect(loadStudentData(memoryStore())).toEqual({ data: emptyStudentData(), notice: null });
  });

  it('lee lo que guardó', () => {
    const store = memoryStore();
    const data = { ...emptyStudentData(), history: { 'MAT-095': [{ grade: 'B' as const, period: '2025-1' }] } };
    saveStudentData(store, data);
    expect(loadStudentData(store).data).toEqual(data);
  });

  it('si los datos están dañados no los pierde: los aparta y avisa', () => {
    const store = memoryStore({ [STORAGE_KEY]: '{"version":2,"data":{"history":"roto"}}' });
    const result = loadStudentData(store);
    expect(result).toEqual({ data: emptyStudentData(), notice: 'recovered' });
    expect(store.dump()[RECOVERY_KEY]).toContain('roto');
  });

  it('migra el formato anterior y limpia sus claves', () => {
    const store = memoryStore({
      [LEGACY_KEYS.progress]: JSON.stringify({
        'MAT-095': { courseId: 'MAT-095', status: 'passed', grade: 'A', completedAt: '2025-11-01' },
        'ESP-095': { courseId: 'ESP-095', status: 'passed' },
        'ING-100': { courseId: 'ING-100', status: 'in_progress' },
        '[] basura': { status: 'passed' },
      }),
      [LEGACY_KEYS.planner]: JSON.stringify([{ courseId: 'MED-100', sectionCrn: 'MED100001', section: {} }]),
      [LEGACY_KEYS.adminCourses]: '[]',
      'otra-app': 'intacta',
    });

    const { data, notice } = loadStudentData(store);
    expect(notice).toBe('migrated');
    expect(data.history).toEqual({
      'MAT-095': [{ grade: 'A', period: null }],
      'ESP-095': [{ grade: null, period: null }],
    });
    expect(data.current.items).toEqual([{ courseId: 'ING-100', crn: null }]);
    expect(data.plan.items).toEqual([{ courseId: 'MED-100', crn: 'MED100001' }]);
    expect(Object.keys(store.dump()).sort()).toEqual(['otra-app', STORAGE_KEY].sort());
  });
});

describe('saveStudentData', () => {
  it('devuelve false si el navegador rechaza la escritura en vez de romper la app', () => {
    const store = { ...memoryStore(), setItem: () => { throw new Error('QuotaExceededError'); } };
    expect(saveStudentData(store, emptyStudentData())).toBe(false);
  });
});

describe('clearStudentData', () => {
  it('borra sólo las claves de esta app', () => {
    const store = memoryStore({ [STORAGE_KEY]: 'x', [LEGACY_KEYS.planner]: 'y', 'portafolio:tema': 'oscuro' });
    clearStudentData(store);
    expect(store.dump()).toEqual({ 'portafolio:tema': 'oscuro' });
  });
});

describe('respaldo', () => {
  it('ida y vuelta sin pérdida', () => {
    const data = { ...emptyStudentData(), history: { 'MAT-095': [{ grade: 'F' as const, period: '2025-1' }] } };
    expect(parseBackup(serializeBackup(data))).toEqual(data);
  });

  it('rechaza archivos ajenos o dañados con un mensaje entendible', () => {
    expect(() => parseBackup('no es json')).toThrow('no es un JSON válido');
    expect(() => parseBackup('{"app":"otra","version":2,"data":{}}')).toThrow('No se cambió nada');
  });
});
