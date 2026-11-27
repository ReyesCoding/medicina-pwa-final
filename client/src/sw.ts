import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope;

/**
 * Service worker de la app (estrategia injectManifest de vite-plugin-pwa).
 *
 * - Precachea todo el build, incluidos los JSON del pensum y la oferta: la
 *   app funciona completa sin conexión desde la primera visita. Cada deploy
 *   genera un manifest con hashes nuevos, así que los datos se actualizan
 *   con el mismo mecanismo que el código.
 * - No hace skipWaiting automático: la UI avisa "hay una versión nueva" y el
 *   estudiante decide cuándo recargar, para no cambiarle la app a mitad de
 *   una carga de notas.
 */
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// La app usa rutas con hash (#/plan), así que toda navegación es index.html.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

/**
 * La versión anterior usaba un cache manual "medicina-pwa-v-*". Se borra sólo
 * ese prefijo: los caches son por origen y en github.io el origen se comparte
 * con los demás proyectos del usuario.
 */
const LEGACY_CACHE_PREFIX = 'medicina-pwa-v-';
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith(LEGACY_CACHE_PREFIX)).map((key) => caches.delete(key)))),
  );
});
