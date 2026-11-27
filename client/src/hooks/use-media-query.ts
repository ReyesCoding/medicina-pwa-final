import { useSyncExternalStore } from 'react';

/** Suscripción a una media query; renderizar un solo layout evita duplicar el DOM (e IDs) ocultando con CSS. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
