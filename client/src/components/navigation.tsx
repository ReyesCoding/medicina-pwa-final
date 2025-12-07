import { 
  LayoutDashboard, 
  BookOpen, 
  GraduationCap, 
  CalendarClock, 
  Search,
  Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { FilterState } from '@/types';

interface NavigationProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  activeView: string;
  onViewChange: (view: string) => void;
  onShowPlanModal: () => void;
}

export function Navigation({ 
  filters, 
  onFiltersChange, 
  activeView, 
  onViewChange,
  onShowPlanModal 
}: NavigationProps) {

  // Handlers para cambiar filtros de estado (Toggle)
  const toggleStatus = (status: 'passed' | 'available' | null) => {
    onFiltersChange({
      ...filters,
      status: filters.status === status ? null : status
    });
  };

  return (
    // FIX VISUAL: h-full asegura que ocupe toda la altura disponible
    <div className="w-full md:w-64 bg-card border-r flex flex-col h-full">
      
      {/* 1. SECCIÓN SUPERIOR: MENÚ PRINCIPAL */}
      <div className="p-4 space-y-2 shrink-0">
        <Button 
          variant={activeView === 'courses' ? 'secondary' : 'ghost'} 
          className="w-full justify-start text-base font-medium"
          onClick={() => onViewChange('courses')}
        >
          <BookOpen className="mr-2 h-5 w-5 text-primary" />
          Catálogo de Materias
        </Button>

        <Button 
          variant={activeView === 'planner' ? 'secondary' : 'ghost'} 
          className="w-full justify-start text-base font-medium"
          onClick={() => onViewChange('planner')}
        >
          <CalendarClock className="mr-2 h-5 w-5 text-violet-500" />
          Mi Plan (Horario)
        </Button>

        <Button 
          variant={activeView === 'progress' ? 'secondary' : 'ghost'} 
          className="w-full justify-start text-base font-medium"
          onClick={() => onViewChange('progress')}
        >
          <GraduationCap className="mr-2 h-5 w-5 text-emerald-500" />
          Mi Progreso
        </Button>
      </div>

      <Separator />

      {/* 2. SECCIÓN CENTRAL: FILTROS
          FIX VISUAL: flex-1 y overflow-hidden obligan a esta parte a ocupar 
          el espacio sobrante, empujando el footer hacia abajo si fuera necesario
          o permitiendo scroll si la pantalla es chica.
      */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            
            {/* Buscador */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center">
                <Search className="h-4 w-4 mr-2" /> BUSCAR
              </h3>
              <Input 
                placeholder="Código o nombre..." 
                value={filters.searchTerm}
                onChange={(e) => onFiltersChange({...filters, searchTerm: e.target.value})}
                className="bg-background"
              />
            </div>

            {/* Filtros de Estado */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center">
                <Filter className="h-4 w-4 mr-2" /> FILTROS
              </h3>
              
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={filters.status === null ? 'default' : 'outline'}
                  className="cursor-pointer hover:bg-primary/80"
                  onClick={() => toggleStatus(null)}
                >
                  Todas
                </Badge>
                <Badge 
                  variant={filters.status === 'available' ? 'default' : 'outline'}
                  className={`cursor-pointer hover:bg-primary/80 ${filters.status === 'available' ? 'bg-green-600 hover:bg-green-700 border-green-600' : ''}`}
                  onClick={() => toggleStatus('available')}
                >
                  Disponibles
                </Badge>
              </div>
              
              <div className="pt-2 space-y-2">
                 <label className="flex items-center gap-2 text-sm cursor-pointer p-1 hover:bg-muted rounded select-none">
                    <input 
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={filters.electivesOnly}
                      onChange={(e) => onFiltersChange({...filters, electivesOnly: e.target.checked})}
                    />
                    <span>Solo Electivas</span>
                 </label>
              </div>
            </div>

            {/* Selector de Ciclo */}
             <div className="space-y-2">
               <h3 className="text-sm font-semibold text-muted-foreground">CICLO / SEMESTRE</h3>
               <select 
                 className="w-full p-2 rounded-md border bg-background text-sm"
                 value={filters.term || ''}
                 onChange={(e) => onFiltersChange({
                   ...filters, 
                   term: e.target.value ? Number(e.target.value) : null
                 })}
               >
                 <option value="">Todos los Ciclos</option>
                 {Array.from({length: 18}, (_, i) => (
                   <option key={i+1} value={i+1}>Ciclo {i+1}</option>
                 ))}
               </select>
             </div>

          </div>
        </ScrollArea>
      </div>

      {/* 3. FOOTER DEL MENÚ */}
      <div className="p-4 border-t bg-muted/20 text-center shrink-0">
        <p className="text-xs text-muted-foreground">v1.0.0 • Medicina PWA</p>
      </div>
    </div>
  );
}