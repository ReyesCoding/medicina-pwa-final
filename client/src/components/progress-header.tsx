import { GraduationCap, Menu } from 'lucide-react';

interface ProgressHeaderProps {
  onMenuClick?: () => void;
}

export function ProgressHeader({ onMenuClick }: ProgressHeaderProps) {
  return (
    <header className="border-b bg-card text-card-foreground px-4 py-3 md:px-6 md:py-4 sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-3">
        {/* Botón Hamburguesa (Solo Móvil) */}
        <button 
          onClick={onMenuClick}
          className="md:hidden p-2 -ml-2 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          aria-label="Abrir menú"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="p-2 bg-primary/10 rounded-lg shrink-0">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-lg md:text-2xl font-bold leading-tight">
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
    </header>
  );
}