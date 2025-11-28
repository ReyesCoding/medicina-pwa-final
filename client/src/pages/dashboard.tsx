import { useState } from 'react';
import { ProgressHeader } from '@/components/progress-header';
import { Navigation } from '@/components/navigation';
import { CourseList } from '@/components/course-list';
import { CourseDetail } from '@/components/course-detail';
import { ComprehensivePlanModal } from '@/components/comprehensive-plan-modal';
import { AdminPanel } from '@/components/admin-panel';
import { StatsView } from '@/components/stats-view'; // Asegúrate de importar esto
import { Course, FilterState } from '@/types';
import { X } from 'lucide-react'; // Importamos icono de cerrar

export function Dashboard() {
  const [activeView, setActiveView] = useState('courses');
  const [selectedCourse, setSelectedCourse] = useState<Course | undefined>();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    term: null,
    status: null,
    electivesOnly: false,
    inPlanOnly: false,
    searchTerm: ''
  });

  const handleCourseSelect = (course: Course) => {
    setSelectedCourse(course);
  };

  // Función para cerrar el popup móvil
  const closeMobileDetail = () => {
    setSelectedCourse(undefined);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased relative">
      <ProgressHeader />
      
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)]">
        
        {/* Navegación */}
        <Navigation 
          filters={filters}
          onFiltersChange={setFilters}
          activeView={activeView}
          onViewChange={setActiveView}
          onShowPlanModal={() => setShowPlanModal(true)}
        />
        
        <main className="flex-1 overflow-auto w-full">
          {/* LÓGICA DE VISTAS: Si es 'progress', mostramos StatsView. Si no, CourseList. */}
          {activeView === 'progress' ? (
            <StatsView />
          ) : (
            <div className="h-full flex flex-col md:flex-row">
              {/* LISTA DE MATERIAS */}
              <div className="w-full md:w-2/3 border-r-0 md:border-r border-border">
                <CourseList 
                  filters={filters}
                  onCourseSelect={handleCourseSelect}
                  selectedCourse={selectedCourse}
                  onShowPlanModal={() => setShowPlanModal(true)}
                />
              </div>
              
              {/* PANEL DERECHO (Solo Desktop) - Oculto en móvil con hidden md:block */}
              <div className="hidden md:block md:w-1/3 bg-background sticky top-0 h-screen overflow-y-auto">
                {selectedCourse ? (
                  <CourseDetail course={selectedCourse} />
                ) : (
                  <div className="p-6 h-full flex items-center justify-center text-center">
                    <div className="text-muted-foreground">
                      <div className="text-lg font-medium mb-2">Selecciona una materia</div>
                      <p className="text-sm">Haz clic en cualquier materia para ver sus detalles</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* POP-UP MÓVIL (Overlay) 
          Este bloque es NUEVO y es lo que permite ver detalles en el celular
      */}
      {selectedCourse && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center bg-black/80 backdrop-blur-sm p-0 md:hidden animate-in fade-in">
          <div className="bg-background w-full rounded-t-xl sm:rounded-xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col relative animate-in slide-in-from-bottom-10">
            <div className="p-2 border-b flex justify-end bg-muted/20">
              <button onClick={closeMobileDetail} className="p-2 bg-muted rounded-full hover:bg-muted/80">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-1 pb-8">
              <CourseDetail course={selectedCourse} />
            </div>
          </div>
        </div>
      )}

      <ComprehensivePlanModal 
        open={showPlanModal} 
        onClose={() => setShowPlanModal(false)} 
      />
      
      <AdminPanel />
    </div>
  );
}