import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminPage from '@/admin/AdminPage'; 

// --- LÓGICA DE SERVICE WORKER ESTABLE ---
const registerSW = async () => {
  if ('serviceWorker' in navigator) {
    try {
      // QUITAMOS EL TIMESTAMP DINÁMICO para evitar el bucle infinito
      const swUrl = `${import.meta.env.BASE_URL}sw.js`;
      
      const registration = await navigator.serviceWorker.register(swUrl);

      // Si hay una actualización esperando, la activamos pero NO recargamos a lo loco
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      registration.onupdatefound = () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.onstatechange = () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Solo logueamos, no forzamos reload automático para no causar loops
              console.log('Nueva versión disponible. Se aplicará en la próxima visita.');
            }
          };
        }
      };
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  }
};

registerSW();

const isAdmin =
  new URLSearchParams(window.location.search).get('admin') === '1' ||
  localStorage.getItem('admin') === '1';

document.title = isAdmin ? 'Pensum Medicina — Admin' : 'Pensum Medicina';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </React.StrictMode>,
);