import { Switch, Route, Router } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { StudentProgressProvider } from "@/contexts/student-progress-context";
import { Dashboard } from "@/pages/dashboard";
import { AdminCourses } from "@/pages/admin-courses";
import { AdminSections } from "@/pages/admin-sections";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

// --- HOOK PARA HASH ROUTING (GITHUB PAGES FIX) ---
// Esto permite que la app funcione sin servidor, usando /#/ruta
const useHashLocation = () => {
  const currentLocation = () => {
    return window.location.hash.replace(/^#/, "") || "/";
  };

  const [loc, setLoc] = useState(currentLocation());

  useEffect(() => {
    const handler = () => setLoc(currentLocation());

    // Suscribirse a cambios de hash
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to;
  };

  return [loc, navigate] as [string, (to: string) => void];
};

function App() {
  // Eliminamos la lógica de 'base' path porque con HashRouting no es necesaria.
  // La ruta siempre es relativa al index.html cargado.

  return (
    <QueryClientProvider client={queryClient}>
      <StudentProgressProvider>
        <TooltipProvider>
          <Toaster />
          {/* Inyectamos el hook de hash aquí */}
          <Router hook={useHashLocation}>
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/admin/courses" component={AdminCourses} />
              <Route path="/admin/sections" component={AdminSections} />
              <Route component={NotFound} />
            </Switch>
          </Router>
        </TooltipProvider>
      </StudentProgressProvider>
    </QueryClientProvider>
  );
}

export default App;