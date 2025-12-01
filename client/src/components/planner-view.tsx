import { useState, useEffect, useMemo } from 'react';
import { useStudentProgress } from '@/contexts/student-progress-context';
import { Course, Section } from '@/types';
import { generateSuggestedPlan, hasConflict, PlannedSection } from '@/utils/planner-logic';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Sparkles, CalendarClock, AlertCircle } from 'lucide-react';

export function PlannerView() {
  const { passedCourses, getCourseStatus } = useStudentProgress();
  
  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [allSections, setAllSections] = useState<Section[]>([]);
  const [plan, setPlan] = useState<PlannedSection[]>([]);
  const [loading, setLoading] = useState(true);

  // Cargar datos
  useEffect(() => {
    Promise.all([
      fetch('data/courses.json').then(r => r.json()),
      fetch('data/sections.json').then(r => r.json())
    ]).then(([coursesData, sectionsData]) => {
      setAllCourses(coursesData);
      setAllSections(sectionsData);
      
      // Cargar plan guardado
      const saved = localStorage.getItem('medicina-planner-save');
      if (saved) {
        try { setPlan(JSON.parse(saved)); } catch (e) { console.error(e); }
      }
      setLoading(false);
    });
  }, []);

  // Guardar plan al cambiar
  useEffect(() => {
    if (!loading) {
      localStorage.setItem('medicina-planner-save', JSON.stringify(plan));
    }
  }, [plan, loading]);

  // --- FILTROS Y CÁLCULOS ---

  // 1. Materias Disponibles (No aprobadas, Prerrequisitos cumplidos, No en el plan actual)
  const availableCourses = useMemo(() => {
    return allCourses.filter(course => {
      if (plan.some(p => p.courseId === course.id)) return false; // Ya en el plan
      const status = getCourseStatus(course, passedCourses);
      return status === 'available';
    }).sort((a, b) => a.term - b.term);
  }, [allCourses, passedCourses, plan, getCourseStatus]);

  // 2. Créditos
  const totalCredits = plan.reduce((sum, item) => {
    const c = allCourses.find(c => c.id === item.courseId);
    return sum + (c?.credits || 0);
  }, 0);

  // --- ACCIONES ---

  const handleAddSection = (courseId: string, sectionCrn: string) => {
    const section = allSections.find(s => s.crn === sectionCrn);
    if (!section) return;

    // Verificar choques
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
    if (!confirm('¿Quieres que la IA genere un horario automático basado en tu progreso?\nEsto completará tu selección actual.')) return;
    
    // Aquí ocurre la magia
    const suggestion = generateSuggestedPlan(availableCourses, allSections, plan);
    
    if (suggestion.length === plan.length) {
      alert('No se encontraron más materias compatibles con el horario actual.');
    } else {
      setPlan(suggestion);
    }
  };

  if (loading) return <div className="p-8 text-center">Cargando planificador...</div>;

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in">
      
      {/* HEADER DEL PLANIFICADOR */}
      <div className="p-4 border-b bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Mi Plan de Estudios
          </h2>
          <div className="text-sm text-muted-foreground mt-1">
            Créditos: <span className={totalCredits > 28 ? "text-orange-500 font-bold" : "font-bold"}>{totalCredits}</span> / 31
          </div>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
          <Button 
            onClick={handleAutoSuggest} 
            className="w-full md:w-auto bg-violet-600 hover:bg-violet-700 text-white"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Sugerir Plan
          </Button>
          {plan.length > 0 && (
             <Button variant="outline" onClick={() => setPlan([])} className="text-destructive border-destructive/50">
               Limpiar
             </Button>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="selected" className="h-full flex flex-col">
          <div className="px-4 pt-2 md:hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="selected">Seleccionadas ({plan.length})</TabsTrigger>
              <TabsTrigger value="available">Disponibles</TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-auto p-4 md:p-6 grid md:grid-cols-12 gap-6">
            
            {/* COLUMNA 1: MATERIAS SELECCIONADAS (Visible siempre en Desktop, Tab en Movil) */}
            <div className={`md:col-span-7 lg:col-span-8 ${'md:block'}`}>
              <TabsContent value="selected" className="mt-0 h-full space-y-4">
                <h3 className="font-semibold text-lg hidden md:block mb-4">Materias Seleccionadas</h3>
                
                {plan.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed rounded-xl">
                    <p className="text-muted-foreground">Tu plan está vacío.</p>
                    <p className="text-sm text-muted-foreground mt-1">Agrega materias manualmente o usa "Sugerir Plan"</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {plan.map((item) => {
                      const course = allCourses.find(c => c.id === item.courseId);
                      if (!course) return null;
                      return (
                        <Card key={item.courseId} className="border-l-4 border-l-primary shadow-sm">
                          <CardContent className="p-4 flex justify-between items-start gap-3">
                            <div>
                              <div className="font-bold text-sm md:text-base">{course.name}</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {course.id} • {course.credits} Créditos • Sec. {item.sectionCrn}
                              </div>
                              <div className="text-xs font-medium text-primary mt-2 bg-primary/10 inline-block px-2 py-1 rounded">
                                {item.section.schedule?.map(s => `${s.day.substring(0,3)} ${s.startTime}`).join(', ') || 'Sin horario'} • {item.section.room}
                              </div>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleRemove(item.courseId)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </div>

            {/* COLUMNA 2: MATERIAS DISPONIBLES (Visible siempre en Desktop, Tab en Movil) */}
            <div className={`md:col-span-5 lg:col-span-4 ${'md:block'}`}>
              <TabsContent value="available" className="mt-0 h-full space-y-4">
                <h3 className="font-semibold text-lg hidden md:block mb-4">Agregar Materias</h3>
                
                <div className="space-y-3">
                  {availableCourses.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">No hay más materias disponibles por ahora.</div>
                  ) : (
                    availableCourses.map(course => {
                      // Secciones de este curso
                      const sections = allSections.filter(s => s.courseId === course.id);
                      
                      return (
                        <Card key={course.id} className="bg-muted/30">
                          <CardContent className="p-3">
                            <div className="flex justify-between items-start">
                              <div className="text-sm font-medium">{course.name}</div>
                              <Badge variant="outline" className="text-[10px]">{course.id}</Badge>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 mb-3">
                              Semestre {course.term} • {course.credits} Cr.
                            </div>
                            
                            {sections.length > 0 ? (
                              <Select onValueChange={(val) => handleAddSection(course.id, val)}>
                                <SelectTrigger className="h-8 text-xs w-full bg-background">
                                  <SelectValue placeholder="Elegir sección..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {sections.map(s => (
                                    <SelectItem key={s.crn} value={s.crn} className="text-xs">
                                      {s.schedule?.[0]?.day.substring(0,3)} {s.schedule?.[0]?.startTime} ({s.instructor})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="text-xs text-red-400 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Sin secciones
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            </div>

          </div>
        </Tabs>
      </div>
    </div>
  );
}