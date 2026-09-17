import { vlyPlugin } from "@vly-ai/integrations";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/* NULL · vite.config.ts
   NULL is a single-page React app. Routing is hash based (see src/lib/tabs.ts)
   so the built folder can be dropped on any static host without rewrite
   rules: /#/games always lands on the games page.

   HMR stays off, as the preview host requires. */
export default defineConfig({
  base: "./",
  plugins: [vlyPlugin(), react()],
  server: {
    host: true,
    allowedHosts: true,
    hmr: false,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
  build: {
    outDir: "dist",
    target: "es2020",
  },
});
