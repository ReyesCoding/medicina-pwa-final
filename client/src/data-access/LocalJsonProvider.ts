import { DataProvider } from './DataProvider';

const log = (...a: any[]) => console.log('[LocalJsonProvider]', ...a);

/**
 * Regla:
 * - Si hay override en localStorage **y** contiene elementos → úsalo.
 * - Si no hay override o está vacío → fetch a /data/*.json (con BASE_URL).
 * - Nunca persistimos fetch automáticamente en localStorage (solo Admin.save*) .
 */
export class LocalJsonProvider implements DataProvider {
  private coursesMem: any[] | null = null;
  private sectionsMem: any | null = null;

  private readLS<T = any>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async getCourses(): Promise<any[]> {
    if (this.coursesMem) {
      log('courses from mem:', this.coursesMem.length);
      return this.coursesMem;
    }

    // 1) Intento override localStorage
    const lsCourses = this.readLS<any[]>('admin:courses');
    if (Array.isArray(lsCourses) && lsCourses.length > 0) {
      log('courses from localStorage:', lsCourses.length);
      this.coursesMem = lsCourses;
      return lsCourses;
    }

    // 2) Fetch dataset
    const url = `${import.meta.env.BASE_URL}data/courses.json`;
    log('fetching courses:', url);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`courses fetch ${res.status}`);
    const json = await res.json();
    const arr = Array.isArray(json) ? json : [];
    log('courses fetched count:', arr.length);
    this.coursesMem = arr;
    return arr;
  }

  async getSections(): Promise<any> {
    if (this.sectionsMem) {
      log('sections from mem (type):', Array.isArray(this.sectionsMem) ? 'array' : typeof this.sectionsMem);
      return this.sectionsMem;
    }

    // 1) Intento override localStorage
    const lsSections = this.readLS<any>('admin:sections');
    if (lsSections && ((Array.isArray(lsSections) && lsSections.length > 0) || lsSections.courses)) {
      log('sections from localStorage (type):', Array.isArray(lsSections) ? 'array' : 'object');
      this.sectionsMem = lsSections;
      return lsSections;
    }

    // 2) Fetch dataset
    const url = `${import.meta.env.BASE_URL}data/sections.json`;
    log('fetching sections:', url);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`sections fetch ${res.status}`);
    const json = await res.json();
    // Puede ser array plano o { courses: [...] }
    const val = json ?? [];
    log('sections fetched type:', Array.isArray(val) ? 'array' : 'object');
    this.sectionsMem = val;
    return val;
  }

  async saveCourses(courses: any[]): Promise<void> {
    const arr = Array.isArray(courses) ? courses : [];
    this.coursesMem = arr;
    localStorage.setItem('admin:courses', JSON.stringify(arr));
    log('courses saved (ls) count:', arr.length);
  }

  async saveSections(sections: any): Promise<void> {
    const val = sections ?? (Array.isArray(sections) ? [] : { courses: [] });
    this.sectionsMem = val;
    localStorage.setItem('admin:sections', JSON.stringify(val));
    log('sections saved (ls) type:', Array.isArray(val) ? 'array' : 'object');
  }

  /** Útil si quieres limpiar overrides de Admin y volver a datasets del repo */
  clearOverrides() {
    localStorage.removeItem('admin:courses');
    localStorage.removeItem('admin:sections');
    this.coursesMem = null;
    this.sectionsMem = null;
    log('overrides cleared');
  }
}
