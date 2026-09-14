/* NULL · check-links.js
   Every internal path the site points at must exist on disk, because GitHub
   Pages serves files literally: a link to /whatever.html is a 404 unless that
   file is there, and an extensionless /whatever only works through 404.html.

     node scripts/check-links.js

   Scans the HTML files for href/src, then the shipped JavaScript for quoted
   /paths ending in .html (catalog entries, launch URLs, page index). Anything
   missing is printed with the file it came from. Development tool, not part of
   the site. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skipDir = new Set([".git", "node_modules", "dist"]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || skipDir.has(entry.name)) continue;
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

/* "/games/" → games/index.html, "/a.html" → a.html, "/" → index.html */
function resolve(url) {
  const clean = url.split("#")[0].split("?")[0];
  if (!clean || clean === "/") return "index.html";
  const rel = clean.replace(/^\//, "");
  if (fs.existsSync(path.join(root, rel)) && fs.statSync(path.join(root, rel)).isFile()) return rel;
  if (fs.existsSync(path.join(root, rel, "index.html"))) return path.join(rel, "index.html");
  return null;
}

const files = walk(".");
const htmls = files.filter((f) => f.endsWith(".html") && !f.startsWith("releases" + path.sep));
const scriptFiles = files.filter(
  (f) => (f.startsWith("src" + path.sep) && f.endsWith(".js")) || f === "sw.js",
);

const problems = [];
let checked = 0;

for (const file of htmls) {
  const html = fs.readFileSync(path.join(root, file), "utf8");
  const re = /(?:href|src)="(\/[^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    checked++;
    if (!resolve(m[1])) problems.push(file + "  →  " + m[1]);
  }
}

/* quoted absolute paths in the shipped JS (page urls, catalog files, thumbs).
   A line carrying "check-links: fixture" is dropped first: the test suite
   builds entries out of made-up slugs, and those paths are not meant to
   exist on disk. */
for (const file of scriptFiles) {
  const js = fs
    .readFileSync(path.join(root, file), "utf8")
    .split("\n")
    .filter((line) => !line.includes("check-links: fixture"))
    .join("\n");
  const re = /"(\/[A-Za-z0-9._/-]*\.(?:html|svg|png|jpg|jpeg|webp|gif|json|webmanifest))"/g;
  let m;
  while ((m = re.exec(js))) {
    checked++;
    if (!resolve(m[1])) problems.push(file + "  →  " + m[1]);
  }
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
