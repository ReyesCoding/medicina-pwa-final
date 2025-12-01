import { Course, Section } from '@/types';

// Tipos auxiliares para el algoritmo
export interface PlannedSection {
  courseId: string;
  sectionCrn: string;
  section: Section;
}

// Convierte "14:30" a minutos totales (870) para facilitar comparaciones matemáticas
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// Verifica si dos secciones chocan en horario
export const hasConflict = (sec1: Section, sec2: Section): boolean => {
  // Si no tienen horario definido, no chocan
  if (!sec1.schedule || !sec2.schedule) return false;

  for (const s1 of sec1.schedule) {
    for (const s2 of sec2.schedule) {
      // 1. Deben ser el mismo día
      if (s1.day !== s2.day) continue;

      // 2. Convertir a minutos
      const start1 = timeToMinutes(s1.startTime);
      const end1 = timeToMinutes(s1.endTime);
      const start2 = timeToMinutes(s2.startTime);
      const end2 = timeToMinutes(s2.endTime);

      // 3. Verificar superposición (Overlap logic)
      // Chocan si uno empieza antes de que el otro termine
      if (start1 < end2 && start2 < end1) {
        return true;
      }
    }
  }
  return false;
};

// --- ALGORITMO PRINCIPAL: SUGERIR PLAN ---
export const generateSuggestedPlan = (
  availableCourses: Course[],
  allSections: Section[],
  currentPlan: PlannedSection[],
  maxCredits: number = 28 // Límite prudente (un poco menos de 31 para no saturar)
): PlannedSection[] => {
  
  // 1. Empezamos con el plan actual (si el usuario ya eligió algo, lo respetamos)
  const newPlan: PlannedSection[] = [...currentPlan];
  let currentCredits = newPlan.reduce((sum, item) => {
    const course = availableCourses.find(c => c.id === item.courseId);
    return sum + (course?.credits || 0);
  }, 0);

  // 2. Ordenamos las materias disponibles por prioridad (menor cuatrimestre primero)
  // Esto asegura que el algoritmo priorice atrasadas o del ciclo actual.
  const sortedCourses = [...availableCourses].sort((a, b) => {
    if (a.term !== b.term) return a.term - b.term;
    // Si son del mismo ciclo, priorizamos las que tienen más créditos (más difíciles)
    return b.credits - a.credits; 
  });

  // 3. Iteramos materia por materia
  for (const course of sortedCourses) {
    // Si ya está en el plan, saltar
    if (newPlan.some(p => p.courseId === course.id)) continue;

    // Si nos pasamos de créditos, dejar de intentar agregar
    if (currentCredits + course.credits > maxCredits) continue;

    // 4. Buscar secciones para esta materia
    // Nota: Filtramos por ID de curso. Tu JSON usa "courseId": "MED-100"
    const courseSections = allSections.filter(s => s.courseId === course.id);

    // 5. Intentar encontrar una sección que no choque con NADA de lo que ya tenemos en el plan
    const validSection = courseSections.find(candidateSection => {
      // Verificar conflicto con cada materia ya planificada
      const conflicts = newPlan.some(existingItem => 
        hasConflict(existingItem.section, candidateSection)
      );
      return !conflicts;
    });

    // 6. Si encontramos una sección válida, ¡la agregamos!
    if (validSection) {
      newPlan.push({
        courseId: course.id,
        sectionCrn: validSection.crn,
        section: validSection
      });
      currentCredits += course.credits;
    }
  }

  return newPlan;
};