/* NULL · vite.config.js
   Preview-only config. GitHub Pages serves the plain HTML/CSS/JS in this
   folder directly and never reads this file; Vite is here so the hosted
   preview (and `bun run dev`) can serve the same files.

   · appType "mpa": every unknown path answers with 404.html, exactly like
     GitHub Pages. The old "spa" setting served index.html for anything
     (typing /whatever showed the homepage), which no static host would do.
     The 404 fallback below still resolves clean urls first: /schedule finds
     schedule.html, /games/ finds its index, and only genuinely missing
     pages get the barrel.
   · publicDir false: only real paths like /public/favicon.svg resolve, again
     matching how the deployed site is laid out.
   · allowedHosts true: the preview is reached through a proxy, and Vite
     rejects a Host header it does not recognise. A static folder has nothing
     to protect, so accept whatever host the preview uses.
   · HMR stays off (Freebuff requirement). */
import { defineConfig } from "vite";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/* Answers a request the way a static host would: try the literal file, then
   the .html twin, then the folder index, then 404.html. */
function staticHost404(root) {
  return async function (req, res, next) {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    let path;
    try {
      path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    } catch (e) {
      return next();
    }
    if (/\.[a-z0-9]+$/i.test(path)) return next(); /* real files fall through */

    const clean = path.replace(/\/+$/, "") || "/";
    const tries = [
      clean === "/" ? "index.html" : null,
      clean + ".html",
      clean.replace(/\/+$/, "") + "/index.html",
    ].filter(Boolean);
    for (const rel of tries) {
      const file = join(root, rel);
      if (existsSync(file) && !file.endsWith("/")) {
        try {
          const body = await readFile(file);
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(body);
          return;
        } catch (e) {
          break;
        }
      }
    }
    const nf = join(root, "404.html");
    if (existsSync(nf)) {
      try {
        const body = await readFile(nf);
        res.statusCode = 404;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(body);
        return;
      } catch (e) {}
    }
    next();
  };
}

export default defineConfig({
  appType: "mpa",
  publicDir: false,
  plugins: [
    {
      name: "static-host-404",
      configureServer(server) {
        server.middlewares.use(staticHost404(server.config.root));
      },
      configurePreviewServer(server) {
        server.middlewares.use(staticHost404(server.config.root));
      },
    },
  ],
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
