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

      if (start1 < end2 && start2 < end1) {
        return true;
      }
    }
  }
  return false;
};

// --- ALGORITMO SUGERENCIA BLINDADO ---
export const generateSuggestedPlan = (
  availableCourses: Course[],
  allSections: Section[],
  currentPlan: PlannedSection[],
  maxCredits: number = 31
): PlannedSection[] => {
  
  const newPlan: PlannedSection[] = [...currentPlan];
  
  let currentCredits = newPlan.reduce((sum, item) => {
    const course = availableCourses.find(c => c.id === item.courseId);
    return sum + (course?.credits || 0);
  }, 0);

  const sortedCourses = [...availableCourses].sort((a, b) => {
    if (a.term !== b.term) return a.term - b.term;
    return b.credits - a.credits; 
  });

  for (const course of sortedCourses) {
    if (newPlan.some(p => p.courseId === course.id)) continue;
    if (currentCredits + course.credits > maxCredits) continue;

    // BLINDAJE AQUÍ TAMBIÉN:
    const courseSections = allSections.filter(s => {
      // Ignoramos secciones corruptas que no tienen courseId
      if (!s.courseId) return false;

      return (
        s.courseId === course.id || 
        s.courseId.replace(/-/g, '') === course.id.replace(/-/g, '')
      );
    });

    if (courseSections.length === 0) continue;

    const validSection = courseSections.find(candidateSection => {
      const conflicts = newPlan.some(existingItem => 
        hasConflict(existingItem.section, candidateSection)
      );
      return !conflicts;
    });

    if (validSection) {
      newPlan.push({
        courseId: course.id,
        sectionCrn: validSection.crn,
        section: validSection
      });
      currentCredits += course.credits;
    }

    if (currentCredits >= maxCredits) break;
  }

  return newPlan;
};