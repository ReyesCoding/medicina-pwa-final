import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// ⚠️ IMPORTANTE: Pon aquí el nombre que le pondrás a tu nuevo repositorio en GitHub
const REPO_NAME = 'medicina-pwa-final'; 

export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production';

  return {
    // Sirve desde /client
    root: path.resolve(import.meta.dirname, "client"),

    // CORRECCIÓN CRÍTICA:
    // En producción (GitHub Pages), la base debe ser el nombre del repositorio.
    // En desarrollo (localhost), la base es la raíz.
    base: isProduction ? `/${REPO_NAME}/` : '/',

    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "client", "src"),
      },
    },

    build: {
      // CORRECCIÓN CRÍTICA:
      // Cambiamos la salida a una carpeta "dist" limpia en la raíz del proyecto.
      // "import.meta.dirname" es la raíz donde está este archivo.
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ["react", "react-dom"],
            ui: ["@radix-ui/react-dialog", "@radix-ui/react-tabs"],
          },
        },
      },
    },

    server: {
      fs: { strict: true, deny: ["**/.*"] },
    },
  };
});