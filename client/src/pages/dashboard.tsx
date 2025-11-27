import { useState } from 'react';
import { ProgressHeader } from '@/components/progress-header';
import { Navigation } from '@/components/navigation';
import { CourseList } from '@/components/course-list';
import { CourseDetail } from '@/components/course-detail';
import { ComprehensivePlanModal } from '@/components/comprehensive-plan-modal';
import { AdminPanel } from '@/components/admin-panel';
import { Course, FilterState } from '@/types';

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

  const handleShowPlanModal = () => {
    setShowPlanModal(true);
  };

  const handleClosePlanModal = () => {
    setShowPlanModal(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased">
      <ProgressHeader />
      
      {/* CORRECCIÓN 1: Layout Responsivo
         - flex-col: En móvil, los elementos se apilan verticalmente (Menú arriba, contenido abajo).
         - md:flex-row: En pantallas medianas/grandes, se ponen uno al lado del otro.
      */}
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-80px)]">
        
        {/* Navigation: Asumimos que se adaptará al ancho disponible */}
        <Navigation 
          filters={filters}
          onFiltersChange={setFilters}
          activeView={activeView}
          onViewChange={setActiveView}
          onShowPlanModal={handleShowPlanModal}
        />
        
        {/* Main Content */}
        <main className="flex-1 overflow-auto w-full">
          {/* CORRECCIÓN 2: Contenedor interno
             - flex-col en móvil, md:flex-row en escritorio 
          */}
          <div className="h-full flex flex-col md:flex-row">
            
            {/* Course List 
               - w-full: 100% de ancho en móvil.
               - md:w-2/3: 66% de ancho en escritorio.
               - border-r-0: Sin borde derecho en móvil.
               - md:border-r: Borde derecho en escritorio.
            */}
            <div className="w-full md:w-2/3 border-r-0 md:border-r border-border">
              <CourseList 
                filters={filters}
                onCourseSelect={handleCourseSelect}
                selectedCourse={selectedCourse}
                onShowPlanModal={handleShowPlanModal}
              />
            </div>
            
            {/* Course Detail Sidebar (Panel Derecho)
               - hidden: OCULTO en móvil (como pediste para limpiar espacio).
               - md:block: VISIBLE solo en escritorio.
               - md:w-1/3: 33% de ancho en escritorio.
            */}
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
        </main>
      </div>

      <ComprehensivePlanModal 
        open={showPlanModal} 
        onClose={handleClosePlanModal} 
      />
      
      <AdminPanel />
    </div>
  );
}