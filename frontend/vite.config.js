import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const API_TARGET = process.env.API_PROXY_TARGET || "http://localhost:4000";

// The browser always talks to "/api" (same origin); in development Vite
// proxies those calls to the Express API so there is no CORS setup to do.
const proxy = {
  "/api": {
    target: API_TARGET,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
    proxy,
  },
  preview: {
    host: true,
    port: 4173,
    allowedHosts: true,
    proxy,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
