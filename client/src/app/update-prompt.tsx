import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Hora entre chequeos de versión nueva para una app que queda abierta días en el celular. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Avisa cuando hay una versión nueva descargada y deja que el estudiante
 * elija el momento de recargar (el service worker no se activa solo).
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => void registration.update(), UPDATE_CHECK_MS);
    },
    onRegisterError(error) {
      console.error('No se pudo registrar el service worker', error);
    },
  });

  // "Lista sin conexión" es informativo: se va solo. "Versión nueva" espera una decisión.
  useEffect(() => {
    if (!offlineReady) return;
    const timer = setTimeout(() => setOfflineReady(false), 5000);
    return () => clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-border bg-card p-3 text-sm shadow-lg md:bottom-6"
    >
      <span className="flex-1">
        {needRefresh ? 'Hay una versión nueva de la app.' : 'Lista para usar sin conexión.'}
      </span>
      {needRefresh && (
        <Button size="sm" className="h-10" onClick={() => void updateServiceWorker(true)}>
          <RefreshCw /> Actualizar
        </Button>
      )}
      <Button
        size="icon"
        variant="ghost"
        className="h-10 w-10"
        aria-label="Cerrar aviso"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
      >
        <X />
      </Button>
    </div>
  );
}
