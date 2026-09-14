/* NULL · check-links.js
   Every internal path the site points at must exist on disk, because GitHub
   Pages serves files literally. Pages are linked by their clean url
   ("/schedule"), which the host answers through 404.html and the service
   worker; the check maps one to the other.

     node scripts/check-links.js

   Three passes:

     · the HTML pages, where a link is written relative to the page's own
       folder, so "../shop" inside games/index.html means shop.html at the
       root. This is what catches a page moved, renamed or deleted.
     · the shipped JavaScript, which names pages by their site path
       ("/shop", "/games/x/x.html"): the page index, the launch urls and
       the thumbnails. This is what catches a game or app folder deleted
       while something still points at it.
     · a shape guard: internal page links carry no ".html" (clean urls only),
       and no link points at the releases/ folder.

   Development tool, not part of the site. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDir = new Set([".git", "node_modules", "dist", "releases"]);
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|#|\/\/)/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || skipDir.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

/* the file that answers a clean path: /schedule -> schedule.html,
   /games/ -> games/index.html, /games/x/x.html stays itself */
function fileFor(rel) {
  if (/\/$/.test(rel)) return exists(path.posix.join(rel, "index.html"));
  if (/\.[a-z0-9]+$/i.test(rel)) return exists(rel);
  return exists(rel + ".html");
}

function exists(rel) {
  const p = path.join(root, rel);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) return rel;
  return null;
}

/* a site path ("/shop", "/games/"): written from the root */
function resolve(url) {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean || clean === "/") return exists("index.html");
  return fileFor(clean.replace(/^\/+/, ""));
}

/* a link inside a page: relative to the folder that page sits in */
function resolveFrom(page, url) {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean) return page;
  const base = clean.startsWith("/") ? "" : path.posix.dirname(page);
  return fileFor(path.posix.normalize(path.posix.join(base, clean)));
}

const files = walk(".");
const htmls = files.filter((f) => f.endsWith(".html"));
const scriptFiles = files.filter(
  (f) => (f.startsWith("src" + path.sep) && f.endsWith(".js")) || f === "sw.js",
);

const problems = [];
let checked = 0;

/* clean-url shape guard: a page link written with .html defeats the whole
   scheme (the address bar would show the extension again after it cleans) */
function shape(url, from) {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean || EXTERNAL.test(clean) || clean.startsWith("data:")) return;
  if (/\.html$/i.test(clean) && clean !== "/404.html") {
    problems.push(from + "  →  " + url + "  (clean urls: drop the .html)");
  }
}

for (const file of htmls) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  let m;

  const re = /(?:href|src)="([^"{]+)"/g;
  while ((m = re.exec(html))) {
    if (EXTERNAL.test(m[1]) || m[1].startsWith("data:")) continue;
    checked++;
    shape(m[1], file);
    if (!resolveFrom(file, m[1])) problems.push(file + "  →  " + m[1]);
  }

  /* the markdown blocks a page carries (about, the legal pages). markdown.js
     gives one leading slash the served folder, so these are site paths. */
  const md = /\[[^\]]*\]\(([^)\s]+)\)/g;
  while ((m = md.exec(html))) {
    const href = m[1];
    if (href.charAt(0) !== "/" || href.charAt(1) === "/" || EXTERNAL.test(href)) continue;
    checked++;
    shape(href, file);
    if (!resolve(href)) problems.push(file + "  →  " + href);
  }
}

/* quoted site paths in the shipped JS (page urls, catalog files, thumbs) */
for (const file of scriptFiles) {
  const js = fs.readFileSync(path.join(root, file), "utf8");
  const re = /"(\/[A-Za-z0-9._/-]*\.(?:html|svg|png|jpg|jpeg|webp|gif|json|webmanifest))"/g;
  let m;
  while ((m = re.exec(js))) {
    checked++;
    if (!resolve(m[1])) problems.push(file + "  →  " + m[1]);
  }
}

/* the service worker's precache list. A renamed module drops out of the
   offline shell without an error, so every entry has to be a real file.
   sw.js sits at the root, so its entries resolve from there. */
const sw = fs.readFileSync(path.join(root, "sw.js"), "utf8");
const core = sw.slice(sw.indexOf("const CORE = ["), sw.indexOf("].map(at)"));
for (const entry of core.matchAll(/"([^"]+)"/g)) {
  checked++;
  if (!resolveFrom("sw.js", entry[1])) problems.push("sw.js CORE  →  " + entry[1]);
}

/* catalog entries are the one place a missing file would break a whole tile */
const generated = fs.readFileSync(path.join(root, "src/catalog/generated-catalog.js"), "utf8");
const win = {};
new Function("window", generated)(win);
for (const kind of ["games", "apps"]) {
  for (const entry of (win.NULL_CATALOG || {})[kind] || []) {
    checked++;
    if (!resolve(entry.file)) problems.push("catalog " + kind + "  →  " + entry.file);
  }
}

console.log("· checked " + checked + " internal paths");
if (problems.length) {
  console.log("! " + problems.length + " missing:");
  problems.forEach((p) => console.log("   " + p));
  process.exit(1);
}
console.log("· every internal path resolves");
