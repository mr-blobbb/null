#!/usr/bin/env bun
/* NULL · scripts/discover-games.mjs
   Walks the public game stashes and writes src/lib/discovered.ts, so the
   library fills itself instead of being typed in by hand.

   Three sources, in order of quality:
     ubg-py/seraph     the Ultimate Game Stash itself — ~500 folders, each with
                       an index.html, an icon in images/thumbnails and a genre.
                       Its server is gone, but its files are still hosted, so
                       these games really play
     truffled.lol      a manifest with names, playable URLs and thumbnails;
                       every game is meant to be iframed, so entries point
                       straight at it
     gn-math/html      ~850 single-file games; names come from each page's
                       <title>, icons from the gn-math/covers repo, ranked by
                       the jsDelivr download stats so the popular ones land
                       first. Their pages point their own assets at a CDN that
                       still has most of them, so this ranks below the two
                       above
     ubg-py/the-game-stash  the same library kept by hand in one repo; folded
                       into the UGS row above, because it is the same shelf

   Every entry's `file` is put through framable() before it is written out.
   Both GitHub and jsDelivr hand HTML over as text/plain with nosniff, and a
   browser will not run a page it has been told is text — the mirror below
   sends it as text/html and lets the frame have it. Icons stay where they are,
   because an image is an image whatever the header says.

   The output is a generated file. Edit nothing in it by hand: run this
   script again.

     bun scripts/discover-games.mjs
*/

import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "src/lib/discovered.ts";
const GN_TOP = 300; // how many gn-math candidates to try, ranked by downloads

const TRUFFLED = "https://truffled.lol";
const SERAPH_INDEX = "https://raw.githubusercontent.com/ubg-py/seraph/main/games/index.html";
const SERAPH_CDN = "https://cdn.jsdelivr.net/gh/ubg-py/seraph@main/";
const UGS_API = "https://api.github.com/repos/ubg-py/the-game-stash/contents/";
const UGS_RAW = "https://raw.githubusercontent.com/ubg-py/the-game-stash/main/";
const GN_API = "https://api.github.com/repos/gn-math/html/contents/";
const GN_RAW = "https://raw.githubusercontent.com/gn-math/html/main/";
const GN_COVER = "https://raw.githubusercontent.com/gn-math/covers/main/";
const GN_STATS =
  "https://data.jsdelivr.com/v1/stats/packages/gh/gn-math/html@main/files?period=year";

const ghHeaders = { "user-agent": "null-game-discovery", accept: "application/vnd.github+json" };

async function json(url, headers = {}) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function text(url) {
  const r = await fetch(url, { headers: { "user-agent": "null-game-discovery" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

/** A cheap HEAD, for checking a cover exists before we ship its URL. */
async function exists(url) {
  try {
    const r = await fetch(url, { method: "HEAD", headers: { "user-agent": "null-game-discovery" } });
    return r.ok;
  } catch {
    return false;
  }
}

/** A URL a frame will actually run.
 *
 *  raw.githubusercontent serves everything as text/plain with nosniff, and
 *  jsDelivr does the same to .html on purpose — it is not a website host. A
 *  blob bridge can rescue one page, but not the scripts inside it: those come
 *  back as text too, and a browser refuses to execute a script it was told is
 *  text. raw.githack is the same repo over a header that says html for html
 *  and javascript for javascript, which is the whole fix. */
function framable(url) {
  const gh = /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/.exec(url);
  if (gh) return `https://raw.githack.com/${gh[1]}/${gh[2]}/${gh[3]}/${gh[4]}`;
  const jd = /^https:\/\/cdn\.jsdelivr\.net\/gh\/([^@]+)@([^/]+)\/(.+)$/.exec(url);
  if (jd) return `https://raw.githack.com/${jd[1]}/${jd[2]}/${jd[3]}`;
  return url;
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "game";
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const tidy = (s) => s.replace(/,\s*Webport$/i, "").trim();

/* ---------- seraph: the Ultimate Game Stash, one index page for all of it ----------
   Their own listing carries everything worth having — the folder, the name, the
   icon and the genre — so this is one fetch rather than five hundred. jsDelivr
   serves the repo even though the site itself is offline, and it serves each
   kind of file with the content type a browser needs. */

async function seraph() {
  const html = await text(SERAPH_INDEX);
  const out = [];
  /* one row of their listing: the folder, the icon it paints behind itself,
     the genre it files itself under, and the name it shows */
  const rx =
    /href="([a-z0-9_-]+)\/index\.html"[\s\S]{0,400}?url\('\.\.\/images\/thumbnails\/([^']+)'\)[^>]*?data-genre="([^"]*)"[\s\S]{0,300}?<h2>([^<]+)<\/h2>/gi;
  let m;
  while ((m = rx.exec(html))) {
    const [, folder, icon, genre, raw] = m;
    const name = tidy(decode(raw));
    if (name.length < 2) continue;
    out.push({
      id: `sr-${slug(folder)}`,
      name,
      kind: "game",
      file: framable(`${SERAPH_CDN}games/${folder}/index.html`),
      thumb: `${SERAPH_CDN}images/thumbnails/${icon}`,
      labels: ["UGS", ...(genre ? [title(genre)] : [])],
    });
  }
  return out;
}

/** The listing writes its names as plain text between tags. */
function decode(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** "arcade" -> "Arcade", for the genre label. */
function title(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ---------- truffled.lol: manifest with thumbnails, made for iframes ---------- */

async function truffled() {
  const data = await json(`${TRUFFLED}/js/json/g.json`);
  const out = [];
  for (const g of data.games ?? []) {
    if (!g?.name || !g?.url) continue;
    const name = tidy(String(g.name));
    if (name.length < 2) continue; // "1" is not a game
    if (name.length <= 2 && !/[a-z]/i.test(name)) continue; // "-3", "30" — not names
    const url = new URL(g.url, `${TRUFFLED}/`).href;
    const thumb = g.thumbnail ? new URL(g.thumbnail, `${TRUFFLED}/`).href : undefined;
    out.push({
      id: `tf-${slug(name)}`,
      name,
      kind: "game",
      file: url,
      thumb,
      labels: ["Truffled"],
    });
  }
  return out;
}

/* ---------- ubg-py/the-game-stash: one folder per game ---------- */

async function stash() {
  const root = await json(UGS_API, ghHeaders);
  const dirs = root.filter((e) => e.type === "dir");
  const out = [];
  for (const d of dirs) {
    let files;
    try {
      files = await json(d.url, ghHeaders);
    } catch {
      continue;
    }
    const htmls = files.filter((f) => f.name.endsWith(".html"));
    if (!htmls.length) continue;
    const main = htmls.find((f) => f.name.toLowerCase() === `${d.name.toLowerCase()}.html`) ?? htmls[0];
    out.push({
      id: `ugs-${slug(d.name)}`,
      name: d.name,
      kind: "game",
      file: framable(
        UGS_RAW + `${encodeURIComponent(d.name)}/${encodeURIComponent(main.name)}`.replace(/%2F/gi, "/"),
      ),
      labels: ["UGS"],
    });
  }
  return out;
}

/* ---------- gn-math/html: single files, ranked by jsDelivr downloads ---------- */

async function gnmath() {
  const stats = await json(GN_STATS);
  const ranked = (stats ?? [])
    .filter((f) => f.name?.endsWith(".html"))
    .sort((a, b) => (b.hits?.total ?? 0) - (a.hits?.total ?? 0))
    .slice(0, GN_TOP);

  const out = [];
  for (const f of ranked) {
    const id = f.name.slice(1).replace(/\.html$/, "");
    let head = "";
    try {
      head = (await text(GN_RAW + f.name.slice(1))).slice(0, 4000);
    } catch {
      /* rate limits come and go — the next run picks up what this one missed */
      continue;
    }
    const title = /<title>([^<]+)<\/title>/i.exec(head)?.[1]?.trim();
    if (!title) continue; // no title means no name, and a number is not a name
    const cover = GN_COVER + encodeURIComponent(id) + ".png";
    out.push({
      id: `gn-${slug(id)}`,
      name: title,
      kind: "game",
      file: framable(GN_RAW + f.name.slice(1)),
      thumb: (await exists(cover)) ? cover : undefined,
      labels: ["GN-Math"],
    });
  }
  return out;
}

/* ---------- merge: first source wins on a name clash ---------- */

/* seraph first: it is the largest set whose files still resolve, and the first
   source to claim a name keeps it */
const sources = [
  ["seraph", seraph],
  ["truffled", truffled],
  ["gn-math", gnmath],
  ["game-stash", stash],
];

const seen = new Set();
const all = [];
for (const [label, run] of sources) {
  try {
    const batch = await run();
    let kept = 0;
    for (const e of batch) {
      const key = norm(e.name);
      if (seen.has(key) || seen.has(e.id)) continue;
      seen.add(key);
      seen.add(e.id);
      all.push(e);
      kept++;
    }
    console.log(`${label.padEnd(11)} ${String(kept).padStart(4)} games`);
  } catch (err) {
    console.error(`${label} failed, skipped — ${err.message}`);
  }
}

const banner = `/* NULL · discovered.ts
   Generated by scripts/discover-games.mjs — do not edit by hand.
   ${all.length} games pulled from the public stashes. Re-run the script to refresh. */

import type { Entry } from "./catalog";

export const DISCOVERED: Entry[] =`;

mkdirSync("src/lib", { recursive: true });
writeFileSync(OUT, `${banner} ${JSON.stringify(all, null, 2)};\n`);
console.log(`\nwrote ${OUT} with ${all.length} games`);
