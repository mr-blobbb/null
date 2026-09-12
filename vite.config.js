/* NULL — vite.config.js
   Preview-only config. GitHub Pages serves the plain HTML/CSS/JS in this
   folder directly and never reads this file; Vite is here so the hosted
   preview (and `bun run dev`) can serve the same files.

   · appType "spa" keeps Vite's HTML fallback on: a request for /games/ or
     /schedule.html resolves to the real file, the way a static host does, so
     the preview's links behave like the deployed site's.
   · publicDir false — only real paths like /public/favicon.svg resolve, again
     matching how the deployed site is laid out.
   · HMR stays off (Freebuff requirement). */
import { defineConfig } from "vite";

export default defineConfig({
  appType: "spa",
  publicDir: false,
  server: {
    host: true,
    hmr: false,
  },
});
