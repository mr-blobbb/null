/* NULL · build-releases.js
   Regenerates the three single-file builds from the live site sources:

     releases/null-regular.html   the whole runtime, readable
     releases/null-mini.html      the same build, compressed
     releases/null-lite.html      full runtime, but stripped: no extra.css
                                  (theme-pack backdrops + particle art), no shop,
                                  no glow, performance mode pinned on: and
                                  compressed, so it is the smallest build

   Each build inlines global.css, extra.css and release.css, every runtime
   module, the release shell, and a copy of the catalog whose games/apps pair
   their metadata with their own code as a data: URI, so a build runs from a
   file:// path, a blob:, an about:blank clone or a GitHub Pages URL with no
   other NULL file present.

   Run it after changing anything the builds should carry:

     node scripts/build-releases.js        (or: bun run releases)

   Node is a build-time tool only. The site itself and everything this script
   writes are plain HTML/CSS/JS: GitHub Pages needs nothing else. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const exists = (p) => fs.existsSync(path.join(root, p));

/* order matters: each module expects the ones above it */
const MODULES = [
  "src/utilities/store.js",
  "src/utilities/econ.js",
  "src/utilities/dom.js",
  "src/utilities/modal.js",
  "src/utilities/theme.js",
  "src/components/seasons.js",
  "src/utilities/scroll.js",
  "src/routing/router.js",
  "src/catalog/catalog.js",
  "src/content/content.js",
  "src/components/tabpresets.js",
  "src/components/schedule.js",
  "src/components/cards.js",
  "src/components/search.js",
  "src/components/daily.js",
  "src/utilities/procgen.js",
  "src/utilities/ext.js",
  "src/components/shell.js",
];

const FALLBACK = {
  game: "public/fallback-assets/thumb-game.svg",
  app: "public/fallback-assets/thumb-app.svg",
  proxy: "public/fallback-assets/thumb-proxy.svg",
};

const MIME = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

const TIERS = {
  regular: { title: "NULL Regular", extraCss: true, minify: false },
  mini: { title: "NULL Mini", extraCss: true, minify: true },
  lite: { title: "NULL Lite", extraCss: false, minify: true },
};

/* "/games/my-game/my-game.html" → "games/my-game/my-game.html" */
const local = (url) => (typeof url === "string" && url.charAt(0) === "/" ? url.slice(1) : null);

function dataUri(file, mime) {
  return "data:" + mime + ";base64," + fs.readFileSync(path.join(root, file)).toString("base64");
}

function htmlUri(file) {
  return "data:text/html;charset=utf-8," + encodeURIComponent(fs.readFileSync(path.join(root, file), "utf8"));
}

/* ---------- catalog: metadata + the code it launches ---------- */
function embedEntry(entry, kind, missing) {
  const out = { ...entry };
  const file = local(entry.file);
  if (file && exists(file)) out.data = htmlUri(file);
  else if (kind !== "proxy") missing.push(entry.id);
  const thumb = local(entry.thumb);
  if (thumb && exists(thumb)) out.thumb = dataUri(thumb, MIME[path.extname(thumb).toLowerCase()] || "image/png");
  else out.thumb = dataUri(FALLBACK[kind], "image/svg+xml");
  return out;
}

function buildCatalog() {
  const win = {};
  /* generated-catalog.js is plain data: `window.NULL_CATALOG = { … }` */
  new Function("window", read("src/catalog/generated-catalog.js"))(win);
  const cat = win.NULL_CATALOG || { games: [], apps: [], proxies: [] };
  const missing = [];
  const out = {
    site: cat.site || "NULL",
    generatedAt: cat.generatedAt || null,
    games: (cat.games || []).map((e) => embedEntry(e, "game", missing)),
    apps: (cat.apps || []).map((e) => embedEntry(e, "app", missing)),
    proxies: (cat.proxies || []).map((e) => embedEntry(e, "proxy", missing)),
  };
  return { out, missing };
}

/* ---------- page assembly ---------- */
function prepaint(pinPerf) {
  return [
    "(function () {",
    "  try {",
    '    var p = JSON.parse(localStorage.getItem("null:prefs") || "{}");',
    '    document.documentElement.dataset.theme = p.theme === "light" ? "light" : "dark";',
    '    if (p.perf) document.documentElement.dataset.perf = p.perf === "ultra" ? "ultra" : "1";',
    '    if (p.glow && p.glow !== "off") document.documentElement.dataset.glow = p.glow;',
    "  } catch (e) {}",
    pinPerf ? '  document.documentElement.dataset.perf = "1";' : "",
    "})();",
  ].filter(Boolean).join("\n");
}

/* an inlined </script> would close the tag it is printed inside */
const safe = (js) => js.replace(/<\/script/gi, "<\\/script");

function page(tier, css, catalogJs) {
  const t = TIERS[tier];
  const js = safe(catalogJs + "\n" + MODULES.map(read).join("\n") + "\n" + read("scripts/release-shell.js"));
  const desc =
    "NULL: a plain black-and-white hub for games, apps and tools. Self-contained " +
    "single-file " + tier + " build: no server, no other files, nothing to install.";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#09090b">
<title>${t.title}</title>
<meta name="description" content="${desc}">
<link rel="icon" href="${dataUri("public/favicon.svg", "image/svg+xml")}">
<style>
${t.minify ? transformSync(css, { loader: "css", minify: true }).code : css.trim()}
</style>
<script>
window.RELEASE_TIER = ${JSON.stringify(tier)};
${prepaint(tier === "lite")}
</script>
</head>
<body>
<a class="skip-link" href="#rel">Skip to content</a>
<div class="glow-bg" aria-hidden="true"></div>
<div id="rel" class="rel-shell"></div>
<script>
${t.minify ? transformSync(js, { loader: "js", minify: true, target: "es2020" }).code : js}
</script>
</body>
</html>
`;
}

/* global.css points the icon font at a path that only exists next to the
   stylesheet, so a standalone build carries the file itself: same idea as the
   games' code. The pattern allows for however many levels up the stylesheet
   sits, so moving it does not quietly drop the font out of the builds. */
const FONT = "public/fonts/material-symbols-rounded.woff2";
function inlineFont(css) {
  if (!exists(FONT)) return css;
  const re = /url\("(?:\.\.\/)*public\/fonts\/material-symbols-rounded\.woff2"\)/g;
  return css.replace(re, 'url("' + dataUri(FONT, "font/woff2") + '")');
}

function cssFor(tier) {
  /* perf.css rides along in every tier so data-perf="ultra" still means
     something inside a single-file build */
  const parts = [read("src/styles/global.css"), read("src/styles/perf.css")];
  if (TIERS[tier].extraCss) {
    parts.push(read("src/styles/extra.css"));
    parts.push(read("src/styles/particles.css"));
  }
  parts.push(read("scripts/release.css"));
  return inlineFont(parts.join("\n"));
}

const catalog = buildCatalog();
const catalogJs =
  "window.NULL_CATALOG = " + JSON.stringify(catalog.out) + ";";

for (const tier of Object.keys(TIERS)) {
  const html = page(tier, cssFor(tier), catalogJs);
  const out = path.join(root, "releases", "null-" + tier + ".html");
  fs.writeFileSync(out, html);
  const size = (html.length / 1024).toFixed(0) + " KB";
  console.log(
    "· releases/null-" + tier + ".html  " + size +
      (TIERS[tier].minify ? "  (minified)" : ""),
  );
}
console.log(
  "· catalog: " + catalog.out.games.length + " games, " +
    catalog.out.apps.length + " apps, " + catalog.out.proxies.length + " proxies",
);
if (catalog.missing.length) {
  console.warn(
    "! no HTML file, left out of the builds: " + catalog.missing.join(", "),
  );
}
