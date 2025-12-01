import { GraduationCap, Menu } from 'lucide-react';

interface ProgressHeaderProps {
  onMenuClick?: () => void;
  onHomeClick?: () => void; // Nuevo prop
}

export function ProgressHeader({ onMenuClick, onHomeClick }: ProgressHeaderProps) {
  return (
    <header className="border-b bg-card text-card-foreground px-4 py-3 md:px-6 md:py-4 sticky top-0 z-30 shadow-sm transition-all duration-200">
      <div className="flex items-center gap-3">
        {/* Botón Hamburguesa */}
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>

        {/* LOGO HOME INTERACTIVO */}
        <div 
          onClick={onHomeClick}
          className="flex items-center gap-3 cursor-pointer group select-none transition-opacity hover:opacity-80"
          title="Ir al Inicio"
        >
          <div className="p-2 bg-primary/10 rounded-lg shrink-0 group-hover:bg-primary/20 transition-colors">
            <GraduationCap className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <h1 className="text-lg md:text-2xl font-bold leading-tight group-hover:text-primary transition-colors">
              Planificador Medicina
            </h1>
            <p className="text-xs text-muted-foreground hidden md:block">
              Programa UTESA 2013 • 18 Semestres + Proyecto Final
            </p>
            <p className="text-xs text-muted-foreground md:hidden">
              Curriculum UTESA 2013
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}