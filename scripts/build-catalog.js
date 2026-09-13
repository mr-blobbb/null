/* NULL · build-catalog.js
   Regenerates src/catalog/generated-catalog.js from the content folders.

     node scripts/build-catalog.js        (or: bun run catalog)

   It walks games/, apps/ and proxies/ and reads each folder's own files:
   Label.txt, Warning.txt, meta.txt, proxy.txt and a thumbnail. The parsing
   rules live in src/utilities/catalog-tool.js, the same file the /tools page
   uses, so the script and the browser builder always produce the same catalog.

   Folders without an .html file (games/apps) or without a Link: (proxies) are
   skipped and reported. Names starting with "." or "_" are ignored.

   Build-time tool only: the deployed site never runs Node. GitHub Actions
   runs this on pushes that touch the content folders (see
   .github/workflows/update-catalog.yml) and commits the refreshed catalog,
   which is why an unchanged library leaves the file (and the timestamp)
   exactly as it was. */

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = "src/catalog/generated-catalog.js";

/* catalog-tool.js is a plain browser module: it only touches `window`, so a
   throwaway object is enough to load it here. One parser, two hosts. */
function loadTool() {
  const win = {};
  new Function("window", fs.readFileSync(path.join(root, "src/utilities/catalog-tool.js"), "utf8"))(win);
  return win.N.catalogTool;
}

const tool = loadTool();
const kinds = [
  { dir: "games", key: "games", kind: "game" },
  { dir: "apps", key: "apps", kind: "app" },
  { dir: "proxies", key: "proxies", kind: "proxy" },
];

const rel = (p) => path.relative(root, p).split(path.sep).join("/");
const exists = (p) => {
  try {
    return fs.statSync(p).isFile();
  } catch (err) {
    return false;
  }
};
const readIf = (p) => (exists(p) ? fs.readFileSync(p, "utf8").trim() : null);

function folders(dir) {
  const base = path.join(root, dir);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !/^[._]/.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

function firstFile(dir, names) {
  for (const name of names) if (exists(path.join(dir, name))) return name;
  return null;
}

function entryFor(dir, slug) {
  const folder = path.join(root, dir, slug);
  const html = firstFile(folder, tool.htmlCandidates(slug));
  if (!html) return null;
  /* the parser wants the folder name ("games", not "game") because it
     builds /games/<slug>/<file> straight from it */
  return tool.entry(dir, slug, {
    html: html,
    thumb: firstFile(folder, tool.thumbCandidates(slug)),
    labels: readIf(path.join(folder, "Label.txt")),
    warning: readIf(path.join(folder, "Warning.txt")),
    meta: readIf(path.join(folder, "meta.txt")),
  });
}

function proxyFor(dir, slug) {
  const folder = path.join(root, dir, slug);
  const txt = firstFile(folder, ["proxy.txt", "link.txt"]);
  if (!txt) return null;
  return tool.proxyEntry(slug, readIf(path.join(folder, txt)));
}

const cat = { site: "NULL", games: [], apps: [], proxies: [] };
const skipped = [];

for (const { dir, key, kind } of kinds) {
  for (const slug of folders(dir)) {
    const entry = kind === "proxy" ? proxyFor(dir, slug) : entryFor(dir, slug);
    if (!entry) {
      skipped.push(rel(path.join(dir, slug)) + (kind === "proxy" ? " (no proxy.txt with a Link:)" : " (no html file)"));
      continue;
    }
    cat[key].push(entry);
  }
}

/* keep the hand-written stamp when the library itself did not change: the
   auto-updater commits this file, and a fresh timestamp on every run would
   mean a commit on every run */
const next = tool.source(cat);
const prev = exists(path.join(root, CATALOG)) ? fs.readFileSync(path.join(root, CATALOG), "utf8") : "";
const shape = (src) => {
  try {
    const win = {};
    new Function("window", src)(win);
    const c = win.NULL_CATALOG || {};
    return JSON.stringify({ games: c.games || [], apps: c.apps || [], proxies: c.proxies || [] });
  } catch (err) {
    return null;
  }
};

const changed = shape(prev) !== shape(next);

if (changed) {
  fs.writeFileSync(path.join(root, CATALOG), next);
  console.log(
    "· wrote " + CATALOG + ": " + cat.games.length + " games, " + cat.apps.length + " apps, " + cat.proxies.length + " proxies",
  );
} else {
  console.log("· catalog is up to date: " + cat.games.length + " games, " + cat.apps.length + " apps, " + cat.proxies.length + " proxies");
}

/* ---------- cache key ----------
   Every page loads the catalog as generated-catalog.js?v=<key>, so the key has
   to move whenever the library does: otherwise a game added today stays
   invisible to anyone whose browser still holds yesterday's copy. The key is
   a hash of the catalog itself: the same library always gets the same key, so
   re-running this (or the Action) leaves the pages untouched. */
const key = createHash("sha1").update(shape(next)).digest("hex").slice(0, 10);

function pages(dir = ".") {
  const out = [];
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "releases") continue;
    const rel = dir === "." ? entry.name : dir + "/" + entry.name;
    if (entry.isDirectory()) out.push(...pages(rel));
    else if (entry.name.endsWith(".html")) out.push(rel);
  }
  return out;
}

let bumped = 0;
for (const file of pages()) {
  const src = fs.readFileSync(path.join(root, file), "utf8");
  const out = src.replace(/generated-catalog\.js\?v=[0-9a-z]+/gi, "generated-catalog.js?v=" + key);
  if (out !== src) {
    fs.writeFileSync(path.join(root, file), out);
    bumped++;
  }
}
console.log("· catalog cache key " + key + (bumped ? ": updated " + bumped + " page(s)" : ": pages already current"));

if (skipped.length) {
  console.log("· skipped " + skipped.length + " folder(s):");
  skipped.forEach((s) => console.log("   " + s));
}
