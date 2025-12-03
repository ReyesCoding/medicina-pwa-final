import { Course, Section } from '@/types';

export interface PlannedSection {
  courseId: string;
  sectionCrn: string;
  section: Section;
}

const timeToMinutes = (time: string): number => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const hasConflict = (sec1: Section, sec2: Section): boolean => {
  if (!sec1.schedule || !sec2.schedule) return false;

  for (const s1 of sec1.schedule) {
    for (const s2 of sec2.schedule) {
      if (s1.day !== s2.day) continue;
      
      const start1 = timeToMinutes(s1.startTime);
      const end1 = timeToMinutes(s1.endTime);
      const start2 = timeToMinutes(s2.startTime);
      const end2 = timeToMinutes(s2.endTime);

      // Lógica de superposición
      if (start1 < end2 && start2 < end1) {
        return true;
      }
    }
  }
  return false;
};

// --- ALGORITMO MEJORADO: 31 CRÉDITOS + ORDEN DE PENSUM ---
export const generateSuggestedPlan = (
  availableCourses: Course[],
  allSections: Section[],
  currentPlan: PlannedSection[],
  maxCredits: number = 31 // Límite exacto de 31
): PlannedSection[] => {
  
  const newPlan: PlannedSection[] = [...currentPlan];
  
  // Calcular créditos actuales
  let currentCredits = newPlan.reduce((sum, item) => {
    const course = availableCourses.find(c => c.id === item.courseId);
    // Si la materia ya está en el plan pero no en available (pq ya se seleccionó), hay que buscarla en un scope global
    // Para simplificar, asumimos que availableCourses tiene todo lo necesario o el peso viene de item.
    // Hack: Si no encontramos el curso, asumimos promedio 3 créditos para no romper, 
    // pero idealmente deberíamos tener acceso a todos los cursos.
    return sum + (course?.credits || 0);
  }, 0);

  // 1. ORDENAMIENTO ESTRATÉGICO
  // Prioridad 1: Menor cuatrimestre (para no dejar materias atrás)
  // Prioridad 2: Mayor cantidad de créditos (meter las difíciles primero)
  const sortedCourses = [...availableCourses].sort((a, b) => {
    if (a.term !== b.term) return a.term - b.term;
    return b.credits - a.credits; 
  });

  // 2. BARRIDO DE MATERIAS
  for (const course of sortedCourses) {
    // Si ya está en el plan, siguiente
    if (newPlan.some(p => p.courseId === course.id)) continue;

    // REGLA DE ORO: Si agregar esta materia se pasa de 31, NO la agregamos.
    if (currentCredits + course.credits > maxCredits) continue;

    // 3. BUSCAR SECCIÓN COMPATIBLE
    // Normalizamos IDs para evitar errores (MED-100 vs MED100)
    const courseSections = allSections.filter(s => 
      s.courseId === course.id || 
      s.courseId.replace(/-/g, '') === course.id.replace(/-/g, '')
    );

    if (courseSections.length === 0) continue; // Si no hay secciones (error de datos), saltamos

    // Buscamos la primera sección que no choque con lo que ya tenemos
    const validSection = courseSections.find(candidateSection => {
      const conflicts = newPlan.some(existingItem => 
        hasConflict(existingItem.section, candidateSection)
      );
      return !conflicts;
    });

    // 4. AGREGAR AL PLAN
    if (validSection) {
      newPlan.push({
        courseId: course.id,
        sectionCrn: validSection.crn,
        section: validSection
      });
      currentCredits += course.credits;
    }

    // Si llegamos exactamente a 30 o 31, podemos parar para optimizar
    if (currentCredits >= maxCredits) break;
  }

  return newPlan;
};