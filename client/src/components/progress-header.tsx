import { GraduationCap } from 'lucide-react';

export function ProgressHeader() {
  return (
    <header className="border-b bg-card text-card-foreground px-4 py-3 md:px-6 md:py-4">
      <div className="flex items-center gap-3">
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