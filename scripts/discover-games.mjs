#!/usr/bin/env bun
/* NULL · scripts/discover-games.mjs
   Walks the gmshelf shelves and writes src/lib/discovered.ts, so the library
   fills itself instead of being typed in by hand.

   Four shelves, each one a JSON list those repos keep for exactly this:

     seraph    ~500 games, a folder each, with its own covers
     truffled  ~500 games, a folder each, with its own covers
     ckv       ~850 single-file games, and a cover for nearly every one
     ugs       ~1500 single-file games, the biggest shelf of the four

   A manifest names its games by path inside its own repo (`/ugs/cl1.html`), so
   a game's real address is a mirror plus that path. The mirror is raw.githack,
   and it is the mirror for one reason: it is the only host here that hands
   html back as html and javascript back as javascript. jsDelivr calls both
   `text/plain`, and a browser will not run a page — or the scripts inside it —
   that it has been told is text. ckv is also past jsDelivr's package limit, so
   over there it does not exist at all.

   Icons are missing from every manifest (they all point at one placeholder) and
   are therefore matched by name: each shelf's covers folder is listed once and
   looked up three ways — the game's folder, its file, its name. ckv carries a
   cover for most of what the other shelves hold too, so it is searched as well
   when a shelf has none of its own.

   Genres are not in these manifests either. They come from the old UGS listing,
   which files every game under a genre, matched by name — and a game the
   listing does not know simply goes without one.

   The output is generated. Edit nothing in it by hand: run this again.

     bun scripts/discover-games.mjs
*/

import { writeFileSync, mkdirSync } from "node:fs";

const OUT = "src/lib/discovered.ts";
const MIRROR = "https://raw.githack.com/";
const JSD = "https://cdn.jsdelivr.net/gh/gmshelf/";
const GH_API = "https://api.github.com/repos/";
/* the old UGS listing, kept only for the genres it carries */
const GENRE_INDEX = "https://raw.githubusercontent.com/ubg-py/seraph/main/games/index.html";

const ghHeaders = { "user-agent": "null-game-discovery", accept: "application/vnd.github+json" };

/* ---------- fetch helpers ---------- */

async function json(url, headers = {}) {
  const r = await fetch(url, { headers: { "user-agent": "null-game-discovery", ...headers } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function text(url) {
  const r = await fetch(url, { headers: { "user-agent": "null-game-discovery" } });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.text();
}

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "game";
/** Names are compared with everything but letters and digits thrown away, so
 *  "1v1.lol", "1v1lol" and "1V1 LOL" are one game. */
const key = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
/** The listing writes its names as escaped markup. */
const decode = (s) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

/* ---------- the shelves ---------- */

const SHELVES = [
  { repo: "gmshelf/seraph", list: `${JSD}seraph/seraph.json` },
  { repo: "gmshelf/truffled", list: `${JSD}truffled/truffled.json` },
  { repo: "gmshelf/ckv", list: `${JSD}ckv/ckv.json` },
  { repo: "gmshelf/ugs", list: `${JSD}ugs/ugs.json` },
];

const PLACEHOLDER = /(^|\/)img\/placeholder\.[a-z]+$/i;

/** Every cover in a shelf, keyed by name with the extension cut off. */
async function covers(repo) {
  const map = new Map();
  let files;
  try {
    files = await json(`${GH_API}${repo}/contents/covers`, ghHeaders);
  } catch {
    return map; // a shelf without a covers folder is a shelf without icons
  }
  for (const f of files) {
    if (!f.name || f.type !== "file") continue;
    map.set(key(f.name.replace(/\.[a-z0-9]+$/i, "")), `covers/${f.name}`);
  }
  console.log(`  ${repo.padEnd(17)} ${String(map.size).padStart(4)} covers`);
  return map;
}

/** One shelf's manifest, as rows. */
function shelfRows(shelf, games) {
  const out = [];
  for (const g of games) {
    const name = decode(String(g?.name ?? ""));
    const path = String(g?.url ?? "");
    if (name.length < 2 || !path) continue; // "1" is a folder, not a name
    out.push({ name, path: path.replace(/^\//, ""), img: String(g?.img ?? "") });
  }
  return out;
}

/* ---------- genres, from the old listing ---------- */

/** name -> genre, out of the Ultimate Game Stash's own index page. That page
 *  is the one place any of this is written down; it is read for that field
 *  alone. */
async function genres() {
  const map = new Map();
  let html;
  try {
    html = await text(GENRE_INDEX);
  } catch (err) {
    console.error(`  genres failed, skipped — ${err.message}`);
    return map;
  }
  const rx = /data-genre="([^"]*)"[\s\S]{0,300}?<h2>([^<]+)<\/h2>/gi;
  let m;
  while ((m = rx.exec(html))) {
    const [, genre, raw] = m;
    const name = decode(raw);
    if (genre && name) map.set(key(name), genre.charAt(0).toUpperCase() + genre.slice(1));
  }
  console.log(`  ${"genres".padEnd(17)} ${String(map.size).padStart(4)} names`);
  return map;
}

/* ---------- the walk ---------- */

const coverMaps = new Map();
for (const s of SHELVES) coverMaps.set(s.repo, await covers(s.repo));
const genreOf = await genres();

/* ckv's covers are the widest net, so it is searched before the others */
const COVER_ORDER = ["gmshelf/ckv", "gmshelf/truffled", "gmshelf/seraph"];

/** The cover for a game, or null. Three guesses — its folder, its file, its
 *  name — each one checked against the shelf's own covers and then the wide
 *  nets. */
function coverFor(own, game) {
  const bits = game.path.split("/");
  const file = bits.pop() ?? "";
  const folder = bits.pop() ?? "";
  const stem = file.replace(/\.html?$/i, "");
  const guesses = [folder, stem, stem.replace(/^cl/i, ""), game.name].map(key).filter(Boolean);
  const shelves = [own, ...COVER_ORDER.filter((r) => r !== own)];
  for (const guess of guesses) {
    for (const repo of shelves) {
      const found = coverMaps.get(repo)?.get(guess);
      if (found) return { repo, path: found };
    }
  }
  return null;
}

const seen = new Set();
const rows = [];

for (const shelf of SHELVES) {
  let games;
  try {
    const data = await json(shelf.list);
    games = shelfRows(shelf, Array.isArray(data) ? data : (data.games ?? []));
  } catch (err) {
    console.error(`${shelf.repo} failed, skipped — ${err.message}`);
    continue;
  }

  let kept = 0;
  for (const game of games) {
    const name = game.name;
    const id = `${shelf.repo.split("/")[1]}-${slug(name)}`;
    const k = key(name);
    if (seen.has(k) || seen.has(id)) continue; // an earlier shelf claimed it
    seen.add(k);
    seen.add(id);

    /* a manifest that names its own icon is right about it; the rest are
       matched by name */
    const declared =
      game.img && !PLACEHOLDER.test(game.img)
        ? { repo: shelf.repo, path: game.img.replace(/^\//, "") }
        : null;
    const cover = declared ?? coverFor(shelf.repo, game);

    rows.push([
      id,
      name,
      shelf.repo,
      game.path,
      cover?.repo ?? "",
      cover?.path ?? "",
      genreOf.get(k) ?? "",
    ]);
    kept++;
  }
  console.log(`${shelf.repo.padEnd(17)} ${String(kept).padStart(4)} new games`);
}

const withArt = rows.filter((r) => r[5]).length;
const withGenre = rows.filter((r) => r[6]).length;

const banner = `/* NULL · discovered.ts
   Generated by scripts/discover-games.mjs — do not edit by hand.
   ${rows.length} games from the gmshelf shelves: ${withArt} with artwork,
   ${withGenre} filed under a genre. Re-run the script to refresh. */

/** One row, as the script writes it: the address is short because everything
 *  in it is a path inside a shelf rather than a full URL.
 *
 *  [id, name, shelf, file, coverShelf, cover, genre] — an empty string means
 *  "none", and a cover usually comes from a different shelf than the game
 *  does, which is why it carries its own. */
export type Row = [
  id: string,
  name: string,
  shelf: string,
  file: string,
  coverShelf: string,
  cover: string,
  genre: string,
];

export const ROWS: Row[] = [
${rows.map((r) => JSON.stringify(r)).join(",\n")}
];
`;

mkdirSync("src/lib", { recursive: true });
writeFileSync(OUT, banner);
console.log(`\nwrote ${OUT} with ${rows.length} games (${MIRROR})`);
