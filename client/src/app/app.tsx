import { Loader2, WifiOff } from 'lucide-react';
import { Link, Route, Router, Switch } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/toaster';
import { CatalogView } from '@/features/catalog/catalog-view';
import { CourseDetailProvider } from '@/features/course/course-detail';
import { PlannerView } from '@/features/planner/planner-view';
import { ProgressView } from '@/features/progress/progress-view';
import { SettingsView } from '@/features/settings/settings-view';
import { AppStateProvider, type LoadState } from '@/state/app-state';
import { AppShell } from './app-shell';
import { UpdatePrompt } from './update-prompt';

/**
 * Rutas con hash (#/plan): GitHub Pages no reescribe URLs a index.html, así
 * que una ruta real (/plan) daría 404 al recargar o al abrir un enlace.
 */
export function App() {
  return (
    <>
      <AppStateProvider fallback={(state) => <BootScreen state={state} />}>
        <CourseDetailProvider>
          <Router hook={useHashLocation}>
            <AppShell>
              <Switch>
                <Route path="/" component={CatalogView} />
                <Route path="/plan" component={PlannerView} />
                <Route path="/progreso" component={ProgressView} />
                <Route path="/ajustes" component={SettingsView} />
                <Route>
                  <p className="text-muted-foreground">
                    Esta sección no existe.{' '}
                    <Link href="/" className="text-primary underline">
                      Ir a Materias
                    </Link>
                  </p>
                </Route>
              </Switch>
            </AppShell>
          </Router>
        </CourseDetailProvider>
      </AppStateProvider>
      <Toaster />
      <UpdatePrompt />
    </>
  );
}

function BootScreen({ state }: { state: LoadState }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      {state.status === 'error' ? (
        <>
          <WifiOff className="h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="max-w-sm">No se pudieron cargar los datos del pensum. Revisá tu conexión e intentá de nuevo.</p>
          <Button className="h-11" onClick={state.retry}>
            Reintentar
          </Button>
        </>
      ) : (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p role="status" className="text-muted-foreground">
            Cargando pensum…
          </p>
        </>
      )}
    </div>
  );
}
