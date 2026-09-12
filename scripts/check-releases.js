/* NULL — check-releases.js
   Smoke test for the single-file builds. Loads each releases/null-*.html with
   its scripts running, fails on any uncaught error, and drives the parts that
   only exist inside a release: the shell renders, the nav switches views, a
   library card opens the overlay player instead of navigating away, settings
   and shop mount, the theme toggle flips.

     node scripts/check-releases.js

   jsdom has no layout engine, so this checks behaviour and wiring — not how
   anything looks. Development tool, not part of the site. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUILDS = ["null-regular.html", "null-mini.html", "null-lite.html"];

let failed = 0;
const ok = (cond, label) => {
  if (!cond) failed++;
  console.log((cond ? "  ok   " : "  FAIL ") + label);
};

const click = (el) => {
  if (!el) return false;
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent("click", { bubbles: true }));
  return true;
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const byText = (nodes, re) => Array.prototype.find.call(nodes, (n) => re.test(n.textContent.trim()));

function load(build) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    const msg = String((e && e.message) || e);
    /* jsdom has no CSS/layout engine: skip its stylesheet and iframe noise */
    if (/Could not parse CSS|Not implemented: (HTMLIFrameElement|window\.|navigation)/i.test(msg)) return;
    if (/Not implemented:/i.test(msg)) return; /* jsdom gaps (scrollTo, etc.), not page bugs */
    errors.push(msg);
  });
  vc.on("error", (msg) => errors.push(String(msg)));

  const html = fs.readFileSync(path.join(root, "releases", build), "utf8");

  /* the icon font is served from a path that only exists on the site, so a
     build has to carry the file itself — without it every icon in a standalone
     copy renders as nothing */
  ok(html.includes("data:font/woff2;base64,"), "carries the icon font");

  const dom = new JSDOM(html, {
    url: "https://null.test/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(win) {
      /* jsdom ships no matchMedia; the theme respects reduced-motion through it */
      win.matchMedia = win.matchMedia || ((q) => ({
        matches: false,
        media: q,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {},
      }));
    },
  });
  return { dom, errors };
}

for (const build of BUILDS) {
  console.log("\n" + build);
  const { dom, errors } = load(build);
  const win = dom.window;
  const doc = win.document;
  const lite = build.indexOf("lite") > -1;
  /* the shell boots on DOMContentLoaded */
  await wait(500);
  if (errors.length) console.log("  errors: " + errors.slice(0, 4).join(" | "));

  ok(win.RELEASE_TIER === build.replace("null-", "").replace(".html", ""), "tier is set");
  ok((win.NULL_CATALOG.games || []).length > 0, "embedded catalog loads (" + win.NULL_CATALOG.games.length + " games)");
  ok(/^data:text\/html/.test(win.NULL_CATALOG.games[0].data), "games carry their own code as a data: URI");

  const navBtns = doc.querySelectorAll(".rel-nav button");
  ok(navBtns.length > 3, "shell renders the nav (" + navBtns.length + " pages)");
  ok(!!doc.querySelector(".rel-hero"), "home view renders the hero");
  ok(doc.querySelectorAll(".libgrid .tcard").length > 0, "featured grid renders cards");
  ok(!!doc.querySelector("#dailyStrip") === !lite, "daily crate strip " + (lite ? "hidden on lite" : "present"));

  /* nav → library */
  click(byText(navBtns, /^Games$/));
  const cards = doc.querySelectorAll(".libgrid .tcard");
  ok(!!doc.querySelector(".view-head") && cards.length > 0, "games view lists the library (" + cards.length + " cards)");

  /* a card must open the overlay, not navigate to a player page */
  click(cards[0]);
  const frame = doc.querySelector(".player iframe");
  ok(!!doc.querySelector(".player") && !!frame, "a card opens the player overlay");
  ok(!!frame && /^data:text\/html/.test(frame.getAttribute("src") || ""), "the game runs from its embedded copy");
  click(doc.querySelector(".player-bar .btn-icon"));
  ok(!doc.querySelector(".player"), "closing the player removes the overlay");

  /* search results route back into the same overlay */
  const searchHit = win.NULL_CATALOG.games[0];
  win.N.launch.game(searchHit);
  ok(!!doc.querySelector(".player iframe"), "N.launch.game opens the overlay too");
  click(doc.querySelector(".player-bar .btn-icon"));

  /* settings */
  click(byText(doc.querySelectorAll(".rel-nav button"), /^Settings$/));
  const rows = doc.querySelectorAll(".set-row");
  const packs = doc.querySelectorAll(".set-card .shop-card");
  ok(rows.length >= 4, "settings rows mount (" + rows.length + ")");
  ok(packs.length > 0 === !lite, "theme pack / particle cards " + (lite ? "hidden on lite" : "present (" + packs.length + ")"));
  ok(!!byText(rows, /glow border/i) === !lite, "glow row " + (lite ? "hidden on lite" : "present"));
  const dataBtns = Array.prototype.map.call(doc.querySelectorAll(".set-row button"), (b) => b.textContent.trim());
  ok(
    dataBtns.some((t) => /Download/.test(t)) && dataBtns.some((t) => /Upload/.test(t)) && dataBtns.some((t) => /Wipe/.test(t)),
    "data download / upload / wipe rows present",
  );

  const before = doc.documentElement.dataset.theme;
  const want = before === "dark" ? "Light" : "Dark";
  const themeBtn = byText(doc.querySelectorAll(".set-row button"), new RegExp("^" + want + "$"));
  click(themeBtn);
  ok(
    before !== doc.documentElement.dataset.theme,
    "theme switch flips (" + before + " → " + doc.documentElement.dataset.theme +
      (themeBtn ? " via \"" + themeBtn.textContent.trim() + "\"" : " — no Dark/Light button found") + ")",
  );

  /* shop */
  const shopBtn = byText(doc.querySelectorAll(".rel-nav button"), /^Shop$/);
  ok(!!shopBtn === !lite, "shop " + (lite ? "absent on lite" : "in the nav"));
  if (shopBtn) {
    click(shopBtn);
    ok(!!doc.querySelector(".eco-bar"), "shop shows the economy bar");
    ok(doc.querySelectorAll(".shop-card").length > 4, "shop lists unlocks (" + doc.querySelectorAll(".shop-card").length + " rows)");
  }

  /* schedule + announcements views still mount */
  const schedBtn = byText(doc.querySelectorAll(".rel-nav button"), /^Schedule$/);
  if (schedBtn) {
    click(schedBtn);
    /* no school today (weekend) is a valid render too */
    ok(
      !!doc.querySelector(".sched-row") || !!doc.querySelector(".today-card") || /no school/i.test(doc.body.textContent),
      "schedule view mounts",
    );
  }

  /* the announce + backups views are reachable and render something */
  const annBtn = byText(doc.querySelectorAll(".rel-nav button"), /^News$/);
  if (annBtn) {
    click(annBtn);
    ok(doc.querySelectorAll(".ann-card").length > 0, "announcements view lists posts");
  }

  ok(errors.length === 0, "no uncaught errors" + (errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""));
  win.close();
}

console.log(failed ? "\n" + failed + " check(s) failed" : "\nall release checks passed");
process.exit(failed ? 1 : 0);
