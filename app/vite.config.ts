import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Orion MotoCine: la app (React) se construye en dist/ y el Worker
// (worker/index.ts) la sirve como "assets" estáticos. En `npm run dev`
// las llamadas a /api se mandan al servidor de prueba
// (scripts/mock-server.mjs, puerto 8788) para no tocar GitHub.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: { proxy: { "/api": "http://localhost:8788" } },
});
