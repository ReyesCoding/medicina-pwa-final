import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { loadDataset, type Dataset } from '@/data/dataset';
import type { PlanContext } from '@/domain/planner';
import { evaluateProgress, type ProgressSnapshot } from '@/domain/progress';
import { toast } from '@/hooks/use-toast';
import { loadStudentData, saveStudentData, STORAGE_KEY, type KeyValueStore, type StudentData } from './storage';
import { studentReducer, type StudentAction } from './student-reducer';

interface StudentContextValue {
  data: StudentData;
  dispatch: (action: StudentAction) => void;
  /** `false` si el navegador no está dejando guardar (modo privado, cuota llena). */
  storageOk: boolean;
}

const DatasetContext = createContext<Dataset | null>(null);
const StudentContext = createContext<StudentContextValue | null>(null);

/** localStorage puede lanzar al solo leerlo (Safari con cookies bloqueadas); se cae a memoria. */
function resolveStore(): KeyValueStore {
  try {
    const probe = '__medicina-pwa-probe__';
    window.localStorage.setItem(probe, probe);
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => void memory.set(key, value),
      removeItem: (key) => void memory.delete(key),
    };
  }
}

export function AppStateProvider({ children, fallback }: { children: ReactNode; fallback: (state: LoadState) => ReactNode }) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState({ status: 'loading' });
    loadDataset()
      .then((dataset) => !cancelled && setLoadState({ status: 'ready', dataset }))
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error(error);
        setLoadState({ status: 'error', retry: () => setAttempt((n) => n + 1) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (loadState.status !== 'ready') return <>{fallback(loadState)}</>;
  return (
    <DatasetContext.Provider value={loadState.dataset}>
      <StudentProvider>{children}</StudentProvider>
    </DatasetContext.Provider>
  );
}

export type LoadState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'ready'; dataset: Dataset };

function StudentProvider({ children }: { children: ReactNode }) {
  const store = useMemo(resolveStore, []);
  const initial = useMemo(() => loadStudentData(store), [store]);
  const [data, rawDispatch] = useReducer(studentReducer, initial.data);
  const [storageOk, setStorageOk] = useState(true);
  const skipNextSave = useRef(true);

  useEffect(() => {
    if (initial.notice === 'migrated') {
      toast({ title: 'Datos actualizados', description: 'Tu progreso de la versión anterior se pasó al nuevo formato.' });
    } else if (initial.notice === 'recovered') {
      toast({
        title: 'No se pudieron leer tus datos guardados',
        description: 'Se guardó una copia aparte y la app empezó vacía. Si tenés un respaldo, importalo en Ajustes.',
        variant: 'destructive',
      });
    }
  }, [initial.notice]);

  useEffect(() => {
    // El primer render ya refleja lo guardado; escribirlo de nuevo sería redundante.
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setStorageOk(saveStudentData(store, data));
  }, [data, store]);

  // Varias pestañas abiertas: la que no hizo el cambio se sincroniza.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      skipNextSave.current = true;
      rawDispatch({ type: 'replace', data: loadStudentData(store).data });
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [store]);

  const requestedPersistence = useRef(false);
  const dispatch = useCallback((action: StudentAction) => {
    rawDispatch(action);
    // iOS puede borrar el almacenamiento de sitios poco usados; pedir
    // persistencia la primera vez que hay datos reales lo hace menos probable.
    if (!requestedPersistence.current && navigator.storage?.persist) {
      requestedPersistence.current = true;
      void navigator.storage.persist().catch(() => undefined);
    }
  }, []);

  const value = useMemo(() => ({ data, dispatch, storageOk }), [data, dispatch, storageOk]);
  return <StudentContext.Provider value={value}>{children}</StudentContext.Provider>;
}

export function useDataset(): Dataset {
  const dataset = useContext(DatasetContext);
  if (!dataset) throw new Error('useDataset debe usarse dentro de AppStateProvider');
  return dataset;
}

export function useStudent(): StudentContextValue {
  const value = useContext(StudentContext);
  if (!value) throw new Error('useStudent debe usarse dentro de AppStateProvider');
  return value;
}

/**
 * Estado académico derivado. Hay dos evaluaciones porque responden preguntas
 * distintas: `snapshot` es la situación real (lo que muestran catálogo y
 * progreso) y `planContext` puede asumir aprobado lo que se está cursando
 * para planificar el cuatrimestre siguiente.
 */
export function useAcademic(): { snapshot: ProgressSnapshot; planContext: PlanContext } {
  const { courses, coursesById, sectionsByCourse } = useDataset();
  const { data } = useStudent();

  const enrolled = useMemo(() => new Set(data.current.items.map((item) => item.courseId)), [data.current.items]);
  const snapshot = useMemo(() => evaluateProgress(courses, data.history, { enrolled }), [courses, data.history, enrolled]);
  const planContext = useMemo(() => {
    const assume = data.plan.assumeCurrentPassed && enrolled.size > 0;
    const planningSnapshot = assume
      ? evaluateProgress(courses, data.history, { enrolled, assumeEnrolledPassed: true })
      : snapshot;
    return { coursesById, sectionsByCourse, snapshot: planningSnapshot };
  }, [courses, coursesById, sectionsByCourse, data.history, data.plan.assumeCurrentPassed, enrolled, snapshot]);

  return { snapshot, planContext };
}
