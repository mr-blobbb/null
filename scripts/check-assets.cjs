/* Guard against the failure that left every page unstyled: a broken or
   missing stylesheet link, an unparsable CSS file, or a service worker that
   caches transformed (JS-wrapped) CSS and then serves it to <link> tags.

   Run with: node scripts/check-assets.cjs */
const fs = require("fs");
const path = require("path");
const postcss = require("postcss");

let failures = 0;
function check(name, ok) {
  console.log((ok ? "ok  " : "FAIL") + "  " + name);
  if (!ok) failures++;
}

const PAGES = [
  "index.html",
  "404.html",
  "player.html",
  "schedule.html",
  "settings.html",
  "announcements.html",
  "about.html",
  "backups.html",
  "cookies.html",
  "district.html",
  "license.html",
  "privacy.html",
  "terms.html",
  "shop.html",
  "games/index.html",
  "apps/index.html",
  "proxies/index.html",
];

function resolveLocal(url) {
  return url.split("?")[0].replace(/^\//, "");
}

/* ---------------------------------------------------------------- *
 * 1. every page links real stylesheets and real scripts             *
 * ---------------------------------------------------------------- */
let badLinks = [];
let missingStyles = [];
PAGES.forEach((page) => {
  const html = fs.readFileSync(page, "utf8");
  const styles = html.match(/<link[^>]+rel="stylesheet"[^>]*>/g) || [];
  if (styles.length < 2) missingStyles.push(page);
  styles.forEach((tag) => {
    const m = tag.match(/href="([^"]+)"/);
    if (!m) return;
    const local = resolveLocal(m[1]);
    if (!fs.existsSync(local)) badLinks.push(page + " -> " + m[1]);
  });
  (html.match(/<script src="[^"]+"><\/script>/g) || []).forEach((tag) => {
    const m = tag.match(/src="([^"]+)"/);
    const local = resolveLocal(m[1]);
    if (!fs.existsSync(local)) badLinks.push(page + " -> " + m[1]);
  });
});
check("every page links more than one stylesheet", missingStyles.length === 0);
check("every stylesheet/script href resolves to a file", badLinks.length === 0);
if (badLinks.length) console.log("     missing: " + badLinks.join(", "));

/* ---------------------------------------------------------------- *
 * 2. the CSS itself parses in a strict parser                        *
 * ---------------------------------------------------------------- */
["src/styles/global.css", "src/styles/extra.css"].forEach((file) => {
  const css = fs.readFileSync(file, "utf8");
  let ok = true;
  try {
    postcss.parse(css, { from: file });
  } catch (e) {
    ok = false;
    console.log("     " + file + ": " + e.message);
  }
  check(path.basename(file) + " parses", ok);
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  check(path.basename(file) + " braces balance", open === close && open > 0);
});

/* ---------------------------------------------------------------- *
 * 3. the service worker never stores a mistyped response            *
 * ---------------------------------------------------------------- */
const sw = fs.readFileSync("sw.js", "utf8");
check("sw.js guards cached response types", /function storable/.test(sw) && /text\/css/.test(sw));
check("sw.js doesn't bulk-precache blindly (no cache.addAll)", !/\.addAll\(/.test(sw));
check("sw.js runs the asset cache network-first", /network first/i.test(sw));
check("sw.js cache names were bumped past the poisoned v1", /const CACHE = "null-v[2-9]/.test(sw) && !/null-v1/.test(sw));
check("sw.js drops old caches on activate", /k !== CACHE && k !== RUNTIME/.test(sw));

const shell = fs.readFileSync("src/components/shell.js", "utf8");
check("shell skips the service worker on dev/preview hosts", /devHost/.test(shell) && /getRegistrations/.test(shell));

console.log(failures ? "FAILURES: " + failures : "ALL ASSET CHECKS PASS");
process.exit(failures ? 1 : 0);
