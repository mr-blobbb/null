/* NULL — vite.config.js
   Preview-only config. GitHub Pages serves the plain HTML/CSS/JS in this
   folder directly and never reads this file; Vite is here so the hosted
   preview (and `bun run dev`) can serve the same files.

   · appType "spa" keeps Vite's HTML fallback on: a request for /games/ or
     /schedule.html resolves to the real file, the way a static host does, so
     the preview's links behave like the deployed site's.
   · publicDir false — only real paths like /public/favicon.svg resolve, again
     matching how the deployed site is laid out.
   · allowedHosts true — the preview is reached through a proxy, and Vite
     rejects a Host header it does not recognise. A static folder has nothing
     to protect, so accept whatever host the preview uses.
   · HMR stays off (Freebuff requirement). */
import { defineConfig } from "vite";

export default defineConfig({
  appType: "spa",
  publicDir: false,
  server: {
    host: true,
    allowedHosts: true,
    hmr: false,
  },
  preview: {
    host: true,
    allowedHosts: true,
  },
});
