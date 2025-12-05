import { useState, useEffect, useMemo } from 'react';
import { useStudentProgress } from '@/contexts/student-progress-context';
import { Course, Section } from '@/types';
import { generateSuggestedPlan, hasConflict, PlannedSection, normalizeId } from '@/utils/planner-logic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Sparkles, CalendarClock, AlertCircle } from 'lucide-react';

export function PlannerView() {
  const { passedCourses, getCourseStatus } = useStudentProgress();
  
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [plan, setPlan] = useState<PlannedSection[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper para formatear hora (13:45 -> 01:45 PM)
  const formatTimeDisplay = (time: string) => {
    if (!time || time === '00:00') return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  // Helper para días cortos
  const formatDayDisplay = (day: string) => {
    return day.substring(0, 3) + '.'; // Lun. Mar. Mié.
  };

  useEffect(() => {
    const baseUrl = import.meta.env.BASE_URL; 
    
    Promise.all([
      fetch(`${baseUrl}data/courses.json`).then(r => r.json()),
      fetch(`${baseUrl}data/sections.json`).then(r => r.json())
    ]).then(([coursesData, sectionsData]) => {
      const validCourses = Array.isArray(coursesData) ? coursesData : (coursesData.courses || []);
      const validSections = Array.isArray(sectionsData) ? sectionsData : (sectionsData.sections || sectionsData.courses || []);

      setAllCourses(validCourses);
      setAllSections(validSections);
      
      const saved = localStorage.getItem('medicina-planner-save');
      if (saved) {
        try { setPlan(JSON.parse(saved)); } catch (e) { console.error(e); }
      }
      setLoading(false);
    }).catch(err => {
      console.error("Error cargando datos:", err);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem('medicina-planner-save', JSON.stringify(plan));
    }
  }, [plan, loading]);

  const availableCourses = useMemo(() => {
    if (!Array.isArray(allCourses)) return [];
    return allCourses.filter(course => {
      if (plan.some(p => p.courseId === course.id)) return false; 
      const status = getCourseStatus(course, passedCourses);
      return status === 'available';
    }).sort((a, b) => a.term - b.term);
  }, [allCourses, passedCourses, plan, getCourseStatus]);

  const totalCredits = plan.reduce((sum, item) => {
    const c = allCourses.find(c => c.id === item.courseId);
    return sum + (c?.credits || 0);
  }, 0);

  const getSectionsForCourse = (courseId: string) => {
    if (!Array.isArray(allSections)) return [];
    const target = normalizeId(courseId);
    return allSections.filter(s => s.courseId && normalizeId(s.courseId) === target);
  };

  const handleAddSection = (courseId: string, sectionCrn: string) => {
    const section = allSections.find(s => s.crn === sectionCrn);
    if (!section) return;

    const conflict = plan.find(p => hasConflict(p.section, section));
    if (conflict) {
      const conflictCourse = allCourses.find(c => c.id === conflict.courseId);
      alert(`⚠️ Choque de horario con ${conflictCourse?.name || conflict.courseId}`);
      return;
    }
    setPlan([...plan, { courseId, sectionCrn, section }]);
  };

  const handleRemove = (courseId: string) => {
    setPlan(plan.filter(p => p.courseId !== courseId));
  };

  const handleAutoSuggest = () => {
    if (!confirm('¿Generar horario automático?')) return;
    const suggestion = generateSuggestedPlan(availableCourses, allSections, plan);
    if (suggestion.length === plan.length) {
      alert('No se encontraron más materias compatibles.');
    } else {
      setPlan(suggestion);
    }
  };

  if (loading) return <div className="p-8 text-center animate-pulse">Cargando...</div>;

  // --- UI COMPONENTS ---

  const SelectedList = () => (
    <div className="space-y-4 h-full overflow-y-auto pb-20 md:pb-0">
      <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
        <span className="bg-primary/10 text-primary px-2 py-0.5 rounded text-sm">{plan.length}</span>
        Seleccionadas
      </h3>
      {plan.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-xl bg-muted/10">
          <p className="text-muted-foreground text-sm">Horario vacío.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plan.map((item) => {
            const course = allCourses.find(c => c.id === item.courseId);
            if (!course) return null;
            return (
              <Card key={item.courseId} className="border-l-4 border-l-green-500 shadow-sm">
                <CardContent className="p-3 flex justify-between items-start gap-2">
                  <div className="overflow-hidden">
                    <div className="font-bold text-sm truncate">{course.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                       {/* VISUALIZACIÓN AMIGABLE DE HORARIO */}
                       {item.section.schedule?.map(s => 
                         s.startTime === '00:00' ? 'Horario Rotativo/Virtual' : 
                         `${formatDayDisplay(s.day)} ${formatTimeDisplay(s.startTime)} - ${formatTimeDisplay(s.endTime)}`
                       ).join(' • ')}
                       <span className="ml-2 px-1 bg-secondary rounded text-[10px]">{item.section.room}</span>
                    </div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleRemove(item.courseId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  const AvailableList = () => (
    <div className="space-y-4 h-full overflow-y-auto pb-20 md:pb-0">
      <h3 className="font-semibold text-lg mb-2">Disponibles</h3>
      <div className="space-y-3">
        {availableCourses.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">No hay materias disponibles.</div>
        ) : (
          availableCourses.map(course => {
            const sections = getSectionsForCourse(course.id);
            return (
              <Card key={course.id} className="bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="text-sm font-medium leading-tight">{course.name}</div>
                    <Badge variant="secondary" className="text-[10px] shrink-0 ml-1">{course.credits} Cr.</Badge>
                  </div>
                  
                  {sections.length > 0 ? (
                    <Select onValueChange={(val) => handleAddSection(course.id, val)}>
                      <SelectTrigger className="h-8 text-xs w-full bg-background">
                        <SelectValue placeholder="Elegir horario..." />
                      </SelectTrigger>
                      <SelectContent>
                        {sections.map(s => (
                          <SelectItem key={s.crn} value={s.crn} className="text-xs">
                             {/* OPCIONES DEL DROPDOWN AMIGABLES */}
                             {s.schedule?.[0]?.startTime === '00:00' ? 'Horario Especial' :
                               `${s.schedule?.[0]?.day} ${formatTimeDisplay(s.schedule?.[0]?.startTime || '')}`
                             }
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs text-amber-500 flex items-center gap-1 bg-amber-50 p-1.5 rounded">
                      <AlertCircle className="h-3 w-3" /> Sin secciones abiertas
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in">
      <div className="p-4 border-b bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Mi Plan de Estudios
          </h2>
          <div className="text-sm text-muted-foreground mt-1">
            Créditos: <span className={totalCredits > 31 ? "text-destructive font-bold" : "text-primary font-bold"}>{totalCredits}</span> / 31
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <Button onClick={handleAutoSuggest} className="w-full md:w-auto bg-violet-600 hover:bg-violet-700 text-white" disabled={totalCredits >= 31}>
            <Sparkles className="h-4 w-4 mr-2" /> Sugerir Plan
          </Button>
          {plan.length > 0 && (
             <Button variant="outline" onClick={() => setPlan([])} className="text-destructive border-destructive/50">Limpiar</Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="md:hidden h-full flex flex-col">
          <Tabs defaultValue="available" className="h-full flex flex-col">
            <div className="px-4 pt-2 shrink-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="selected">Seleccionadas ({plan.length})</TabsTrigger>
                <TabsTrigger value="available">Disponibles</TabsTrigger>
              </TabsList>
            </div>
            <div className="flex-1 overflow-hidden p-4">
              <TabsContent value="selected" className="h-full mt-0"><SelectedList /></TabsContent>
              <TabsContent value="available" className="h-full mt-0"><AvailableList /></TabsContent>
            </div>
          </Tabs>
        </div>

        <div className="hidden md:grid md:grid-cols-12 h-full gap-6 p-6 overflow-hidden">
          <div className="md:col-span-7 lg:col-span-8 h-full overflow-hidden border rounded-xl p-4 bg-muted/10">
            <SelectedList />
          </div>
          <div className="md:col-span-5 lg:col-span-4 h-full overflow-hidden border rounded-xl p-4 bg-muted/10">
            <AvailableList />
          </div>
        </div>
      </div>
    </div>
  );
}