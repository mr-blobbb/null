// NULL — vite.config.js
// Vite is used only as a dev/preview server here; deployment is plain
// static GitHub Pages (root-relative paths). Freebuff requires HMR to stay
// disabled — server.hmr stays false and is never changed.
import { defineConfig } from "vite";

export default defineConfig({
  appType: "mpa", // no SPA fallback — 404.html is real
  server: {
    hmr: false,
  },
});
