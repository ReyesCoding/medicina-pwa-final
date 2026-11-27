/// <reference types="vitest" />
import { readFileSync } from 'node:fs';
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const ROOT = import.meta.dirname;
const { version } = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { version: string };

/**
 * GitHub Pages sirve el proyecto en /<repo>/. Se usa una base absoluta (y no
 * './') para que el scope del service worker y del manifest sea fijo y no
 * dependa de la URL desde la que se abre la app.
 */
const REPO_NAME = 'medicina-pwa-final';
const THEME = '#0f172a';

export default defineConfig(({ command }) => ({
  root: path.resolve(ROOT, 'client'),
  base: command === 'build' ? `/${REPO_NAME}/` : '/',
  define: { __APP_VERSION__: JSON.stringify(version) },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      // Se publica como sw.js, el mismo nombre que el service worker anterior:
      // así las instalaciones existentes reciben la actualización.
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,json,png,ico,pdf,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      manifest: {
        name: 'Pensum Medicina UTESA',
        short_name: 'Pensum Med',
        description: 'Planificador del pensum de Medicina UTESA 2013: notas, índice, requisitos y horarios.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'any',
        background_color: THEME,
        theme_color: THEME,
        categories: ['education', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(ROOT, 'client', 'src') },
  },
  build: {
    outDir: path.resolve(ROOT, 'dist'),
    emptyOutDir: true,
  },
  test: {
    root: ROOT,
    include: ['client/src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
}));
