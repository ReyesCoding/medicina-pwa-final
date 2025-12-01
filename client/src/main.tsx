import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminPage from '@/admin/AdminPage'; // Mantenemos tu componente original

// --- LÓGICA DE ACTUALIZACIÓN DEL SERVICE WORKER (FIX PANTALLA BLANCA) ---
const updateSW = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // 1. Timestamp para evitar caché del navegador sobre el propio sw.js
      const swUrl = `${import.meta.env.BASE_URL}sw.js?t=${Date.now()}`;
      
      const registration = await navigator.serviceWorker.register(swUrl);

      // 2. Si hay un SW esperando, forzar activación
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // 3. Escuchar cambios de estado
      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nueva versión instalada -> Forzar recarga
              console.log('Nueva versión detectada. Recargando...');
              window.location.reload();
            }
          };
        }
      };
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  }
};

// Ejecutamos la lógica de actualización
updateSW();

const isAdmin =
  new URLSearchParams(window.location.search).get('admin') === '1' ||
  localStorage.getItem('admin') === '1';

document.title = isAdmin ? 'Pensum Medicina — Admin' : 'Pensum Medicina';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </React.StrictMode>,
);