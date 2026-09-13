/* NULL · build-font.js
   Builds the icon font NULL ships, from the upstream Material Symbols Rounded
   variable font.

     bun run font        (or: node scripts/build-font.js)

   Every icon in the interface is drawn by that font: the P map in
   src/utilities/dom.js names a glyph and d.icon() prints it into a
   <span class="msr">. Upstream the font is one 5 MB file covering all ~3,600
   Google icons. NULL uses 67, so this cuts it down to those glyphs (about
   90 KB) and writes public/fonts/. Run it after adding a name to the P map.

   Three things decided how this works, and all three are load-bearing:

     · The P map holds codepoints, not ligature names. Naming icons by their
       ligature means keeping every letter, and HarfBuzz's layout closure then
       pulls all ~3,600 ligature glyphs back in: the "subset" comes out at
       4.7 MB. Naming them by codepoint keeps 67 glyphs plus the filled
       variants the FILL axis substitutes to, and nothing else.
     · Layout closure stays ON for the same reason: the filled heart and star
       are *different glyphs* that the font swaps in through GSUB feature
       variations when FILL goes to 1, so they can only be kept by closure.
     · The variable axes are kept, because those filled states are the FILL
       axis rather than separate icons.

   Nothing is written until every icon has been re-drawn and its outline
   compared against the full font at FILL 0 and FILL 1, so a subset that
   quietly lost the filled glyphs fails the build instead of shipping.

   The upstream file is cached in .cache/ so a rerun works offline; neither it
   nor the cache is ever committed. Node is a build-time tool here: the .woff2
   it writes is a plain static file that GitHub Pages serves like any other.

   The full font is fetched through the Google Fonts CSS API rather than a
   fixed fonts.gstatic.com URL, because those URLs are versioned (…/v372/) and
   the version moves. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import subsetFont from "subset-font";
import * as hb from "harfbuzzjs";
import fontverter from "fontverter";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CACHE = path.join(root, ".cache", "material-symbols-rounded.woff2");
const OUT = path.join(root, "public", "fonts", "material-symbols-rounded.woff2");

/* a UA that understands woff2 keeps Google from answering with the (much
   bigger) ttf */
const CSS_URL =
  "https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/* ---------- what the site asks for ---------- */

/* the ICON pane of the P map in dom.js: a name, and either a codepoint escape
   or: for a name that is still written as words: the ligature to look up */
function iconTable() {
  const src = fs.readFileSync(path.join(root, "src", "utilities", "dom.js"), "utf8");
  const start = src.indexOf("var P = {");
  const block = src.slice(start, src.indexOf("};", start));

  const out = [];
  for (const m of block.matchAll(/(\w+):\s*"((?:\\.|[^"\\])*)"/g)) {
    const value = JSON.parse('"' + m[2] + '"');
    out.push({ name: m[1], value, isCodepoint: value.length === 1 && value.charCodeAt(0) >= 0xe000 });
  }
  if (!out.some((e) => e.name === "help")) out.push({ name: "help", value: "help", isCodepoint: false });
  return out;
}

/* ---------- the upstream font ---------- */

async function upstream() {
  if (fs.existsSync(CACHE)) return fs.readFileSync(CACHE);

  const css = await fetch(CSS_URL, { headers: { "user-agent": UA } }).then((r) => {
    if (!r.ok) throw new Error("Google Fonts CSS: " + r.status);
    return r.text();
  });
  const url = (css.match(/url\((https:\/\/[^)]+\.woff2)\)/) || [])[1];
  if (!url) throw new Error("no woff2 in the Google Fonts CSS");

  console.log("· downloading " + url);
  const font = Buffer.from(await fetch(url).then((r) => r.arrayBuffer()));
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, font);
  return font;
}

/* ---------- working with the font ----------
   HarfBuzz is handed the .ttf form because the wasm build cannot decode woff2
   itself: it reads an empty face out of one, which would quietly fail every
   glyph. fontverter converts, the same way subset-font feeds it. */

function fontFrom(ttf) {
  const face = new hb.Face(new hb.Blob(ttf));
  const font = new hb.Font(face);

  function glyph(text) {
    const buf = new hb.Buffer();
    buf.addText(text);
    buf.guessSegmentProperties();
    hb.shape(font, buf);
    const infos = buf.getGlyphInfos();
    return infos.length === 1 && infos[0].codepoint !== 0 ? infos[0].codepoint : null;
  }

  /* the drawn outline, as a flat command list, so two fonts can be compared
     without caring that a subset renumbers every glyph */
  function outline(text) {
    const id = glyph(text);
    if (!id) return null;
    const cmds = [];
    const draw = new hb.DrawFuncs();
    draw.setMoveToFunc((x, y) => cmds.push("M", x, y));
    draw.setLineToFunc((x, y) => cmds.push("L", x, y));
    draw.setQuadraticToFunc((cx, cy, x, y) => cmds.push("Q", cx, cy, x, y));
    draw.setCubicToFunc((a, b, c, d, x, y) => cmds.push("C", a, b, c, d, x, y));
    draw.setClosePathFunc(() => cmds.push("Z"));
    font.drawGlyph(id, draw);
    return cmds.join(",");
  }

  function setFill(value) {
    font.setVariations([new hb.Variation("FILL", value)]);
  }

  return { face, glyph, outline, setFill };
}

/* Which codepoint does a ligature end up at? Only needed for a name still
   spelled out in words, which is also the moment to tell the reader what to
   paste into the P map. */
function codepointsByGlyph(api) {
  /* harfbuzzjs hands back a VIEW into wasm memory, and reading it throws once
     that memory grows, so the heap is warmed up front, then copied at once */
  new hb.Blob(new Uint8Array(32 * 1024 * 1024));

  const byGlyph = new Map();
  for (const cp of Array.from(api.face.collectUnicodes())) {
    const id = api.glyph(String.fromCodePoint(cp));
    if (id && !byGlyph.has(id)) byGlyph.set(id, cp);
  }
  return byGlyph;
}

/* ---------- build ---------- */

const table = iconTable();
console.log("· " + table.length + " icon glyphs named in src/utilities/dom.js");

const upstreamWoff2 = await upstream();
const full = fontFrom(await fontverter.convert(upstreamWoff2, "truetype"));

const byGlyph = codepointsByGlyph(full);
const resolved = [];
for (const entry of table) {
  if (entry.isCodepoint) {
    resolved.push({ ...entry, cp: entry.value.charCodeAt(0) });
    continue;
  }
  const id = full.glyph(entry.value);
  const cp = id && byGlyph.get(id);
  if (!cp) {
    console.error("· the font has no glyph for \"" + entry.value + "\" (" + entry.name + ")");
    process.exit(1);
  }
  /* a name written as words still works, but the map wants the codepoint:
     saying so here is easier than reading it out of the font by hand */
  console.log(
    "· " + entry.name + ": paste \\u" + cp.toString(16) + "  (" + entry.value + ")",
  );
  resolved.push({ ...entry, cp });
}

const text = String.fromCodePoint(...resolved.map((e) => e.cp));
const subset = await subsetFont(upstreamWoff2, text, { targetFormat: "woff2" });
const small = fontFrom(await fontverter.convert(subset, "truetype"));

/* every icon has to survive the cut and draw exactly what the full font drew:
   at both ends of the FILL axis, since that is the filled heart/star state */
const broke = [];
for (const fill of [0, 1]) {
  full.setFill(fill);
  small.setFill(fill);
  for (const entry of resolved) {
    if (full.outline(entry.value) !== small.outline(entry.value)) {
      broke.push(entry.name + (fill ? " (filled)" : ""));
    }
  }
}
if (broke.length) {
  console.error("· wrong or missing in the subset: " + broke.join(", "));
  process.exit(1);
}

/* the site sets FILL/wght/GRAD/opsz through font-variation-settings, so the
   subset has to stay variable instead of flattening to one instance */
const axes = Object.keys(small.face.getAxisInfos());
const lost = Object.keys(full.face.getAxisInfos()).filter((a) => !axes.includes(a));
if (lost.length) {
  console.error("· the subset lost the " + lost.join("/") + " axis");
  process.exit(1);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, subset);

const kb = (n) => Math.round(n / 1024) + " KB";
console.log(
  "· wrote public/fonts/material-symbols-rounded.woff2: " +
    kb(subset.length) +
    " (from " +
    kb(upstreamWoff2.length) +
    "), " +
    resolved.length +
    " glyphs matched at FILL 0 and 1, axes " +
    axes.join("/"),
);
