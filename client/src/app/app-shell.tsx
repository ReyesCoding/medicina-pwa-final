import type { ReactNode } from 'react';
import { BookOpen, CalendarDays, GraduationCap, Settings, Stethoscope } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { formatGpa } from '@/domain/grades';
import { cn } from '@/lib/utils';
import { useAcademic } from '@/state/app-state';

const NAV = [
  { href: '/', label: 'Materias', title: 'Materias del pensum', icon: BookOpen },
  { href: '/plan', label: 'Plan', title: 'Plan de cuatrimestre', icon: CalendarDays },
  { href: '/progreso', label: 'Progreso', title: 'Mi progreso', icon: GraduationCap },
  { href: '/ajustes', label: 'Ajustes', title: 'Ajustes y respaldo', icon: Settings },
] as const;

/**
 * Navegación inferior en el celular (alcance del pulgar, como una app nativa)
 * y en la cabecera en pantallas anchas.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { snapshot } = useAcademic();
  const current = NAV.find((item) => item.href === location);

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-8">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      <header className="border-b border-border bg-card/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Stethoscope className="h-7 w-7 shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold leading-tight">Pensum Medicina</p>
            <p className="text-xs text-muted-foreground">UTESA · 2013</p>
          </div>
          <Link
            href="/progreso"
            className="rounded-md px-2 py-1 text-right text-xs text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="block">
              Índice <strong className="text-foreground">{formatGpa(snapshot.gpa.value)}</strong>
            </span>
            <span className="block">
              {snapshot.degreeCredits}/{snapshot.totalCredits} cr
            </span>
          </Link>
          <nav aria-label="Secciones" className="hidden md:block">
            <NavLinks location={location} variant="top" />
          </nav>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-6xl px-4 py-5">
        <h1 className="mb-4 text-2xl font-bold">{current?.title ?? 'Página no encontrada'}</h1>
        {children}
      </main>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <NavLinks location={location} variant="bottom" />
      </nav>
    </div>
  );
}

function NavLinks({ location, variant }: { location: string; variant: 'top' | 'bottom' }) {
  return (
    <ul className={cn('flex', variant === 'bottom' ? 'justify-around' : 'gap-1')}>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = location === href;
        return (
          <li key={href} className={variant === 'bottom' ? 'flex-1' : undefined}>
            <Link
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                variant === 'bottom' ? 'min-h-14 flex-col gap-0.5 text-[11px]' : 'h-10 gap-2 px-3 text-sm',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                variant === 'top' && active && 'bg-accent',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
