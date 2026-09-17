/* NULL · check-pages.js
   Smoke test for the real, multi-file site. Each page is loaded with its own
   stylesheets dropped and its scripts inlined, so jsdom (which has no network
   here, on purpose) still runs the page exactly as a browser loads it. Fails
   on any uncaught error and asserts the things that only exist once the
   page's script has run: the rail, the tab strip, the icon set, the library
   controls, the shop shelves, the profile screens, the proxy window and the
   settings sheet.

     node scripts/check-pages.js

   jsdom has no layout engine, so this checks behaviour and wiring: not how
   anything looks. Development tool, not part of the site. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsdom from "jsdom";

const { JSDOM, VirtualConsole } = jsdom;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* every page on the site. The list is short on purpose: a page that is not
   here should not be on disk either. */
const PAGES = [
  "index.html",
  "shop.html",
  "profile.html",
  "changelog.html",
  "extensions.html",
  "settings.html",
  "games/index.html",
  "apps/index.html",
  "proxies/index.html",
  "player.html",
  "404.html",
];

/* the pages that wear the full chrome */
const CHROME = PAGES.filter((p) => p !== "player.html");

let failed = 0;
const ok = (cond, label) => {
  if (!cond) failed++;
  console.log((cond ? "  ok   " : "  FAIL ") + label);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* swap every <script src="..."> for its contents and drop the stylesheet
   links: the page then needs nothing from outside the file system. Scripts are
   asked for relative to the page, the way the browser asks for them. */
function inline(html, page) {
  return html
    .replace(/<script src="([^"]+)"><\/script>/g, (whole, src) => {
      const rel = path.posix.join(path.posix.dirname(page), src.split("?")[0]);
      const file = path.resolve(root, rel);
      if (!file.startsWith(root) || !fs.existsSync(file)) return whole;
      return "<script>\n" + fs.readFileSync(file, "utf8") + "\n</script>";
    })
    .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, "");
}

function load(page, prefix = "/", seed) {
  const errors = [];
  const vc = new VirtualConsole();
  const ignore = /Could not parse CSS|Could not load|Not implemented:/i;
  vc.on("jsdomError", (e) => {
    const msg = String((e && e.message) || e);
    /* jsdom's own gaps (no layout, no images, no navigation) are not page bugs */
    if (!ignore.test(msg)) errors.push(msg);
  });
  vc.on("error", (m) => {
    const msg = String(m);
    if (!ignore.test(msg)) errors.push(msg);
  });

  const dom = new JSDOM(inline(fs.readFileSync(path.join(root, page), "utf8"), page), {
    url: "https://null.test" + prefix + page.replace(/index\.html$/, ""),
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      /* jsdom ships no matchMedia; the theme asks it about reduced motion */
      win.matchMedia =
        win.matchMedia ||
        ((q) => ({
          matches: false,
          media: q,
          addEventListener() {},
          removeEventListener() {},
          addListener() {},
          removeListener() {},
        }));
      if (seed) seed(win);
    },
  });
  return { dom, errors };
}

for (const page of PAGES) {
  console.log("\n" + page);
  const { dom, errors } = load(page);
  const win = dom.window;
  const doc = win.document;
  await wait(400);
  if (errors.length) console.log("  errors: " + errors.slice(0, 3).join(" | "));

  const chrome = !doc.body.classList.contains("no-chrome");
  ok(!!doc.querySelector(".rail") === chrome, chrome ? "nav mounts" : "nav stays off (raw page)");
  if (chrome) {
    /* the rail is the only navigation, and the head script has to have decided
       that before the first paint */
    ok(
      doc.documentElement.dataset.nav === "side",
      "the rail layout is written on <html> (" + doc.documentElement.dataset.nav + ")",
    );
    const doors = Array.from(doc.querySelectorAll(".rail .ril"));
    ok(
      doors.length === win.N.router.RAIL_TOP.length + win.N.router.RAIL_BOTTOM.length,
      "…with every door drawn (" + doors.length + ")",
    );
    ok(
      doors.map((a) => a.dataset.id).join(",") === "home,games,apps,proxies,shop,profile,changelog,extensions,settings",
      "…in order (" + doors.map((a) => a.dataset.id).join(",") + ")",
    );
    ok(
      doors.every((a) => a.querySelector(".ril-ic svg path, .ril-ic svg circle, .ril-ic svg rect, .ril-ic svg line")),
      "…each drawing a real icon rather than a glyph",
    );

    /* the null:// tab strip: one tab for this page, every door reachable from
       the "+" sheet */
    const strip = doc.querySelector("#tb2");
    ok(!!strip, "the tab strip mounts");
    if (strip) {
      const here = win.N.router.current();
      if (here) {
        ok(
          !!strip.querySelector(".tb2-t.on") &&
            strip.querySelector(".tb2-t.on").textContent.indexOf("null://" + here.host) >= 0,
          "…with this page's tab lit and addressed (null://" + here.host + ")",
        );
      } else {
        /* a 404 has no tab of its own: it is not a page on the site */
        ok(!strip.querySelector(".tb2-t"), "…with no tab for an address that is not a page");
      }
    }
    ok(
      !!win.N.lucide && Object.keys(win.N.lucide).length > 100,
      "the vendored icon set is loaded (" + Object.keys(win.N.lucide || {}).length + " icons)",
    );
  }
  ok(
    !!doc.querySelector(".site-foot") === !!doc.querySelector('[data-mount="foot"]'),
    "footer mounts exactly where the page asks for one",
  );
  if (page !== "player.html") {
    ok(doc.title === "Untitled Slide - Google Slides", "tab preset owns the title (\"" + doc.title + "\")");
  }
  /* the period clock widget is gone: nothing draws one, anywhere */
  ok(!doc.querySelector(".pclock"), "no period clock widget on the page");

  if (page === "index.html") {
    const word = doc.querySelector(".hm-word");
    ok(!!word && word.textContent === "null", "the front door shows the wordmark");
    ok(!!(doc.querySelector("#hmLine") || {}).textContent, "…and a line picked for this load");
    ok(!!doc.querySelector("#homeSearch #searchInput"), "the front door carries the site search");
    ok(doc.querySelectorAll("#hmLinks .ql").length >= 7, "the circles render (All Apps, Add, five shortcuts)");
    ok(!!doc.querySelector("#hmMeta"), "…and the corner readout");
    ok(!!doc.querySelector(".dots") && !doc.querySelector(".dots canvas"), "…over a still grid of dots");
    ok(doc.querySelectorAll(".hm-track .mc").length >= 12, "the card band is populated");
  }

  if (page === "games/index.html") {
    /* the dev console (type nldev) still has to build and open */
    const dev = win.N && win.N.dev;
    ok(!!dev && typeof dev.show === "function", "dev console is exposed as N.dev");
    const type = (s) => {
      for (const ch of s) doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: ch, bubbles: true }));
    };
    type("nldev");
    ok(!!doc.querySelector(".dc-gate"), "typing nldev opens the password gate");
    const field = doc.querySelector(".dc-gate-in");
    if (field && doc.querySelector(".dc-gate-box")) {
      field.value = "mynameisblob123";
      doc.querySelector(".dc-gate-box").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
      await wait(260);
      ok(!!doc.querySelector(".dc-ov"), "the right password opens the console");
      const links = Array.from(doc.querySelectorAll(".dc-ov button")).map((b) => b.textContent);
      const dead = links.filter((t) => /\b(labs|void|blob|time|credits|root map)\b/i.test(t));
      ok(dead.length === 0, "…with no buttons left over for deleted pages (" + dead.join(", ") + ")");
    }
  }

  if (page.endsWith("index.html") && page !== "index.html") {
    ok(!!doc.querySelector("#libSearch") && !!doc.querySelector("#grid"), "library page mounts its controls");
    const tiles = doc.querySelectorAll("#grid .tl-w");
    ok(!!doc.querySelector("#count") && !!doc.querySelector("#count").textContent, "…and counts what it shows");
    ok(tiles.length === doc.querySelectorAll("#grid > *").length, "every tile is one element");
    ok(
      Array.from(tiles).every((t) => t.querySelector(".tl-sq") && t.querySelector(".tl-n")),
      "…a square and a name, nothing else",
    );
    ok(
      !doc.querySelectorAll(".lb-chips .cp").length || doc.querySelectorAll(".lb-chips .cp").length === 2,
      "…under All and Favorites",
    );
  }

  if (page === "proxies/index.html") {
    ok(!!doc.querySelector("#proxyBox .pw"), "the proxy window is mounted above the shortlist");
    ok(!!doc.querySelector("#proxyBox .pw-bar input"), "…with an address bar");
    ok(!!doc.querySelector("#proxyBox .pw-frame iframe"), "…and a frame for the far site");
    ok(!!doc.querySelector("#proxyBox .pw-rows"), "…and the relay / engine rows");
    const u = win.N.proxy.toUrl("example.com");
    ok(u === "https://example.com", "…normalising a bare host (" + u + ")");
    const q = win.N.proxy.toUrl("null is a site");
    ok(/duckduckgo\.com\/\?q=/.test(q), "…and treating anything else as a search");
    ok(!!win.N.proxy.defaultWisp && /^wss:\/\//.test(win.N.proxy.defaultWisp), "…with a default wisp relay");
  }

  if (page === "shop.html") {
    const heads = Array.from(doc.querySelectorAll(".shop-head h2")).map((h) => h.textContent);
    ok(
      heads.indexOf("Avatar decorations") >= 0 && heads.indexOf("Name tags") >= 0,
      "…grouped on their shelves (" + heads.join(", ") + ")",
    );
    ok(!!doc.querySelector("#coinN") && !!doc.querySelector("#giftBtn"), "the purse shows coins and a gift button");
    const cards = Array.from(doc.querySelectorAll("#shopBody .sc"));
    ok(cards.length > 0, "…with items on the shelf (" + cards.length + ")");
    ok(
      cards.every((c) => c.querySelector(".sc-art") && c.querySelector(".sc-n") && c.querySelector(".sc-price")),
      "…each one art, a name and a price",
    );
    ok(
      cards.every((c) => c.querySelector(".sc-lock, .sc-buy") && c.querySelector(".sc-gift")),
      "…a lock state and a gift button",
    );
    /* the gift sheet hands out a code the redeem sheet accepts */
    doc.querySelector("#giftBtn").click();
    await wait(60);
    const codeEl = Array.from(doc.querySelectorAll(".sh-ov .fld")).find((f) => /^NULL-/.test(f.textContent));
    const code = (codeEl || {}).textContent || "";
    ok(/^NULL-[0-9A-Z]+-[0-9A-Z]{4}$/.test(code), "…and a gift code is generated (" + code + ")");
    /* redeeming it hands over the coins the code was minted for */
    const before = win.N.econ.state().coins;
    const redeem = Array.from(doc.querySelectorAll(".sh-ov .sh-foot button")).find((b) => /Redeem one/.test(b.textContent));
    ok(!!redeem, "…with a way into the redeem sheet");
    if (redeem) {
      redeem.click();
      await wait(40);
      const sheet = doc.querySelector(".sh-ov");
      sheet.querySelector("input").value = code;
      sheet.querySelector(".sh-foot button").click();
      await wait(40);
      ok(win.N.econ.state().coins > before, "…and the coins arrive (" + before + " → " + win.N.econ.state().coins + ")");
    }
  }

  if (page === "profile.html") {
    const body = doc.querySelector("#profBody");
    ok(!!body && body.textContent.length > 0, "the profile page paints a screen");
    ok(/Welcome back/.test(body.textContent), "…the sign-in screen first");
    ok(!!body.querySelector(".pf-auth .fld input[type=password]"), "…with a password field");
    /* signing up has to land on the card */
    body.querySelector(".pf-alt .link-btn").click();
    await wait(40);
    const inputs = Array.from(body.querySelectorAll(".pf-auth input"));
    ok(inputs.length === 3, "…and sign up asks for the third field");
    inputs[0].value = "blob";
    inputs[1].value = "hunter2";
    inputs[2].value = "hunter2";
    body.querySelector(".pf-auth").dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    await wait(600);
    ok(!!body.querySelector(".pf-banner"), "signing up renders the card");
    ok(/@blob/.test(body.textContent), "…with the handle on it");
    const lines = Array.from(body.querySelectorAll(".pf-line b")).map((b) => b.textContent);
    ok(
      ["Username", "Password", "Log out", "Delete account"].every((t) => lines.indexOf(t) >= 0),
      "…and the account rows (" + lines.join(", ") + ")",
    );
  }

  if (page === "extensions.html") {
    ok(!!doc.querySelector(".ex-head h1") && doc.querySelector(".ex-head h1").textContent === "Extensions", "the header names the page");
    ok(/null · experimental/.test((doc.querySelector(".ex-tag") || {}).textContent || ""), "…and wears the experimental tag");
    ok(
      (doc.querySelector(".ex-lead") || {}).textContent.indexOf("Chrome Web Store") >= 0,
      "…with the description under it",
    );
    ok(
      (doc.querySelector("#extSearch") || {}).placeholder === "Search the Chrome Web Store",
      "…and the store search box",
    );
  }

  if (page === "settings.html") {
    await wait(120);
    const sheet = doc.querySelector(".st");
    ok(!!sheet, "the sheet opens over the page");
    const secs = Array.from(doc.querySelectorAll(".st-side-b")).map((b) => b.textContent);
    ok(
      secs.join(",") === "Appearance,Data,Privacy & ToS",
      "…with its three sections (" + secs.join(", ") + ")",
    );
    ok(doc.querySelector(".st-side-b.on").textContent === "Appearance", "…landing on appearance");
    const pals = doc.querySelectorAll(".st-body .pal");
    ok(pals.length === win.N.theme.palettes.length, "…listing every palette (" + pals.length + ")");
    const forest = Array.from(pals).find((p) => p.textContent === "Forest");
    ok(!!forest, "…including Forest");
    if (forest) {
      forest.click();
      ok(win.N.prefs.get("palette") === "forest", "…and picking one re-inks the site");
    }
    /* the paperwork lives behind the third section, two documents deep */
    Array.from(doc.querySelectorAll(".st-side-b")).find((b) => b.textContent === "Privacy & ToS").click();
    await wait(40);
    ok((doc.querySelector(".st-body .st-h") || {}).textContent === "Privacy", "…with the paperwork first");
    doc.querySelectorAll(".st-pick-b")[1].click();
    await wait(40);
    ok((doc.querySelector(".st-body .st-h") || {}).textContent === "Terms", "…and the terms behind it");
  }

  if (page === "404.html") {
    ok(!!doc.querySelector(".not-found"), "404 renders its panel");
  }
  if (page === "player.html") {
    ok(!!doc.querySelector(".player"), "player mounts its stage");
    ok(!doc.querySelector("[data-clock]"), "…and carries no clock slot");
  }

  ok(errors.length === 0, "no uncaught errors (" + errors.slice(0, 2).join(" | ") + ")");
  win.close();
}

/* ---------- served from a subfolder ----------
   The same files have to work from a subfolder as well, which is where a
   GitHub Pages project site lives: user.github.io/repo-name/. Nothing is
   hardcoded to a root, so every link a page or the JS builds has to carry that
   folder, and the nav has to still light up the right item. */
console.log("\nserved from /site/");
{
  const { dom, errors } = load("shop.html", "/site/");
  const win = dom.window;
  const doc = win.document;
  await wait(400);
  ok(errors.length === 0, "no script errors (" + errors.slice(0, 2).join(" | ") + ")");
  ok(win.N.base === "/site/", "the folder is worked out from the page (" + win.N.base + ")");
  const home = doc.querySelector('.rail .ril[data-id="home"]');
  ok(!!home && home.getAttribute("href") === "/site/", "the home door links to the root NULL is served from");
  const nav = doc.querySelector('.rail .ril[data-id="games"]');
  ok(!!nav && nav.getAttribute("href").indexOf("/site/") === 0, "nav links carry the folder (" + (nav ? nav.getAttribute("href") : "none") + ")");
  ok(win.N.router.isActive("/games/") === false, "an inactive nav item stays inactive");
}

/* ---------- the 404, answered at an address that is not a folder ---------- */
console.log("\nthe 404, served from a missing path");
{
  const html = fs.readFileSync(path.join(root, "404.html"), "utf8");
  const { dom, errors } = load("404.html", "/games/typo/");
  const win = dom.window;
  const doc = win.document;
  await wait(400);
  ok(errors.length === 0, "no script errors (" + errors.slice(0, 2).join(" | ") + ")");
  ok(doc.documentElement.getAttribute("data-root") === "/", "the page names the root it is served from");
  ok(win.N.base === "/", "the folder does not come from the address (" + win.N.base + ")");
  const brand = doc.querySelector("a.brand");
  ok(!!brand && brand.getAttribute("href") === "/", "the brand links to the real root, not the missing path");
  const back = doc.querySelector("main .actions a");
  ok(!!back && back.getAttribute("href") === "/", "its own links are root-anchored too");
  const loose = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => h.charAt(0) !== "/" && h.charAt(0) !== "#" && !/^[a-z]+:/i.test(h));
  ok(loose.length === 0, "nothing on the page is left relative (" + loose.slice(0, 3).join(", ") + ")");
}

/* ---------- nothing on disk that no page reaches ----------
   The rail, the tab sheet and the search index all read the router, so a page
   the router does not name is a page nobody can open. This is the check that
   keeps a deleted page from coming back as a stray file. */
console.log("\npages on disk vs pages in the router");
{
  const src = fs.readFileSync(path.join(root, "src", "routing", "router.js"), "utf8");
  const named = [...src.matchAll(/file: "([^"]+)"/g)].map((m) => m[1]);
  ok(named.length > 0, "the router names its files (" + named.length + ")");
  for (const file of named) {
    ok(fs.existsSync(path.join(root, file)), "…and " + file + " is on disk");
  }
  const stray = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => e.name)
    .filter((n) => n !== "404.html" && named.indexOf(n) === -1);
  ok(stray.length === 0, "no stray pages at the root (" + stray.join(", ") + ")");
}

console.log("\n" + (failed ? failed + " check(s) failed" : "all checks passed"));
process.exit(failed ? 1 : 0);
