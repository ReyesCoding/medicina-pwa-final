import { useState, useEffect, useRef } from 'react';
import { ProgressHeader } from '@/components/progress-header';
import { Navigation } from '@/components/navigation';
import { CourseList } from '@/components/course-list';
import { CourseDetail } from '@/components/course-detail';
import { AdminPanel } from '@/components/admin-panel';
import { StatsView } from '@/components/stats-view';
import { PlannerView } from '@/components/planner-view'; // <--- IMPORTAMOS LA NUEVA VISTA
import { Course, FilterState } from '@/types';
import { X, ArrowUp, Stethoscope } from 'lucide-react';

export function Dashboard() {
  const [loadingSplash, setLoadingSplash] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // activeView ahora puede ser 'courses', 'progress' o 'planner'
  const [activeView, setActiveView] = useState('courses');
  const [selectedCourse, setSelectedCourse] = useState<Course | undefined>();
  const [filters, setFilters] = useState<FilterState>({
    term: null, status: null, electivesOnly: false, inPlanOnly: false, searchTerm: ''
  });

  const mainScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setLoadingSplash(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const container = mainScrollRef.current;
    if (!container) return;
    const handleScroll = () => setShowScrollTop(container.scrollTop > 300);
    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loadingSplash]);

  const scrollToTop = () => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  const handleCourseSelect = (course: Course) => setSelectedCourse(course);
  
  const handleViewChange = (view: string) => {
    setActiveView(view);
    setMobileMenuOpen(false); 
  };

  const handleHomeClick = () => {
    setActiveView('courses');
    setMobileMenuOpen(false);
    mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // El manejador del antiguo modal ahora simplemente cambia la vista al Planner
  const handleShowPlanner = () => {
    handleViewChange('planner');
  };

  if (loadingSplash) {
    return (
      <div className="fixed inset-0 bg-[#0f172a] z-[100] flex flex-col items-center justify-center animate-fade-out pointer-events-none">
        <div className="p-4 bg-primary/20 rounded-full mb-4 animate-bounce">
          <Stethoscope className="h-16 w-16 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-wider">MEDICINA PWA</h1>
        <p className="text-slate-400 mt-2 text-sm">Organizador Curricular</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased relative">
      <ProgressHeader onMenuClick={() => setMobileMenuOpen(true)} onHomeClick={handleHomeClick} />
      
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)]">
        
        {/* NAVEGACIÓN DESKTOP */}
        <div className="hidden md:block">
          <Navigation 
            filters={filters} onFiltersChange={setFilters}
            activeView={activeView} onViewChange={setActiveView}
            onShowPlanModal={handleShowPlanner} // Redirigimos al Planner View
          />
        </div>

        {/* MENÚ MÓVIL */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 w-3/4 max-w-xs bg-background shadow-xl border-r p-4 animate-slide-in overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="font-bold text-lg">Menú</h2>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-muted rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <Navigation 
                filters={filters} onFiltersChange={setFilters}
                activeView={activeView} onViewChange={handleViewChange}
                onShowPlanModal={handleShowPlanner}
              />
            </div>
          </div>
        )}
        
        {/* CONTENIDO PRINCIPAL DINÁMICO */}
        <main ref={mainScrollRef} className="flex-1 overflow-auto w-full relative h-[calc(100vh-65px)]">
          
          {/* SWITCH DE VISTAS */}
          {activeView === 'progress' ? (
            <StatsView />
          ) : activeView === 'planner' ? (  
            <PlannerView />  // <--- AQUÍ SE RENDERIZA EL NUEVO PLANIFICADOR
          ) : (
            // VISTA POR DEFECTO: LISTA DE MATERIAS
            <div className="h-full flex flex-col md:flex-row">
              <div className="w-full md:w-2/3 border-r-0 md:border-r border-border">
                <CourseList 
                  filters={filters} onCourseSelect={handleCourseSelect} selectedCourse={selectedCourse}
                  onShowPlanModal={handleShowPlanner}
                />
              </div>
              <div className="hidden md:block md:w-1/3 bg-background sticky top-0 h-screen overflow-y-auto">
                {selectedCourse ? (
                  <CourseDetail course={selectedCourse} />
                ) : (
                  <div className="p-6 h-full flex items-center justify-center text-center">
                    <div className="text-muted-foreground">
                      <p>Selecciona una materia para ver detalles</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {showScrollTop && (
            <button onClick={scrollToTop} className="fixed bottom-6 right-6 z-30 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all animate-in zoom-in">
              <ArrowUp className="h-6 w-6" />
            </button>
          )}

        </main>
      </div>

      {/* POPUP MÓVIL */}
      {selectedCourse && activeView === 'courses' && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/80 backdrop-blur-sm md:hidden animate-in fade-in">
          <div className="bg-background w-full rounded-t-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-10">
            <div className="p-2 border-b flex justify-end bg-muted/20">
              <button onClick={() => setSelectedCourse(undefined)} className="p-2 bg-muted rounded-full">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-1 pb-8">
              <CourseDetail course={selectedCourse} />
            </div>
          </div>
        </div>
      )}

      {/* Admin Panel siempre presente pero oculto */}
      <AdminPanel />
    </div>
  );
}