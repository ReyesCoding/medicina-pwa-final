import { useEffect, useMemo, useState } from 'react';
import provider from '@/data-access/provider';

type Course = {
  id: string;
  name: string;
  credits: number;
  theoreticalHours: number;
  practicalHours: number;
  term: number;
  block?: string;
  isElective?: boolean;
  electiveType?: string;
};

export function useCourseData() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<any>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [c, s] = await Promise.all([
          provider.getCourses(),
          provider.getSections(),
        ]);
        if (!cancelled) {
          setCourses(Array.isArray(c) ? c : []);
          setSections(s ?? []);
        }
      } catch (e) {
        console.error('[useCourseData] load error:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const termSummary = useMemo(() => {
    // precalcula un mapa para que getAllTerms sea O(1) luego
    const termMap = new Map<number, {
      term: number; name: string; block?: string; credits: number; courseCount: number;
    }>();
    for (const course of courses) {
      if (!termMap.has(course.term)) {
        termMap.set(course.term, {
          term: course.term,
          name: `CUATRIMESTRE ${course.term}`,
          block: course.block,
          credits: 0,
          courseCount: 0
        });
      }
      const t = termMap.get(course.term)!;
      t.credits += course.credits;
      t.courseCount += 1;
    }
    return termMap;
  }, [courses]);

  // 👇 OJO: devolvemos **la función**, no el resultado
  const getAllTerms = () => {
    return Array.from(termSummary.values()).sort((a, b) => a.term - b.term);
  };

  const getCourseById = (id: string) => courses.find(c => c.id === id);
  const getSectionsByCourse = (courseId: string) => {
    // si tus secciones son { courses: [{id, sections:[]}, ...] } o plano, adapta aquí
    if (Array.isArray(sections)) {
      return sections.filter((s: any) => s.courseId === courseId);
    }
    const entry = sections?.courses?.find((c: any) => c.id === courseId);
    return entry?.sections ?? [];
  };
  const getCoursesByTerm = (term: number) => courses.filter(c => c.term === term);
  const getElectivesByType = (type: string) => courses.filter(c => c.isElective && c.electiveType === type);

  return {
    courses,
    sections,
    loading,
    getCourseById,
    getSectionsByCourse,
    getCoursesByTerm,
    getElectivesByType,
    getAllTerms, // ✅ función
  };
}
