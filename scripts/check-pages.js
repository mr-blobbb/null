/* NULL — check-pages.js
   Smoke test for the real, multi-file site. Each page is loaded with its own
   stylesheets dropped and its scripts inlined, so jsdom (which has no network
   here, on purpose) still runs the page exactly as a browser loads it. Fails
   on any uncaught error and asserts the things that only exist once the
   page's script has run: nav/footer mounting, the tab preset taking over the
   title, the library/announcement/backup lists, and the settings controls
   (performance / ultra / cloak redirect) really applying their pref.

     node scripts/check-pages.js

   jsdom has no layout engine, so this checks behaviour and wiring — not how
   anything looks. Development tool, not part of the site. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import jsdom from "jsdom";

const { JSDOM, VirtualConsole } = jsdom;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PAGES = [
  "index.html",
  "announcements.html",
  "backups.html",
  "schedule.html",
  "shop.html",
  "settings.html",
  "about.html",
  "privacy.html",
  "cookies.html",
  "license.html",
  "terms.html",
  "district.html",
  "tools.html",
  "games/index.html",
  "apps/index.html",
  "proxies/index.html",
  "player.html",
  "404.html",
];

let failed = 0;
const ok = (cond, label) => {
  if (!cond) failed++;
  console.log((cond ? "  ok   " : "  FAIL ") + label);
};

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* swap every <script src="/src/..."> for its contents and drop the stylesheet
   links: the page then needs nothing from outside the file system */
function inline(html) {
  return html
    .replace(/<script src="([^"]+)"><\/script>/g, (whole, src) => {
      const file = path.join(root, src.split("?")[0].replace(/^\/+/, ""));
      if (!file.startsWith(root) || !fs.existsSync(file)) return whole;
      return "<script>\n" + fs.readFileSync(file, "utf8") + "\n</script>";
    })
    .replace(/<link[^>]*rel="stylesheet"[^>]*>/g, "");
}

function load(page) {
  const errors = [];
  const vc = new VirtualConsole();
  const ignore = /Could not parse CSS|Could not load|Not implemented:/i;
  vc.on("jsdomError", (e) => {
    const msg = String((e && e.message) || e);
    /* jsdom's own gaps (no layout, no images) are not page bugs */
    if (!ignore.test(msg)) errors.push(msg);
  });
  vc.on("error", (m) => {
    const msg = String(m);
    if (!ignore.test(msg)) errors.push(msg);
  });

  const dom = new JSDOM(inline(fs.readFileSync(path.join(root, page), "utf8")), {
    url: "https://null.test/" + page.replace(/index\.html$/, ""),
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
  ok(!!doc.querySelector(".topbar") === chrome, chrome ? "nav mounts" : "nav stays off (raw page)");
  ok(
    !!doc.querySelector(".site-foot") === !!doc.querySelector('[data-mount="foot"]'),
    "footer mounts exactly where the page asks for one",
  );
  if (page !== "player.html") {
    ok(doc.title === "Untitled Slide - Google Slides", "tab preset owns the title (\"" + doc.title + "\")");
  }

  if (page === "index.html") {
    ok(doc.querySelectorAll(".tcard").length > 0, "home lists featured cards (" + doc.querySelectorAll(".tcard").length + ")");
  }
  if (page === "announcements.html") {
    const n = doc.querySelectorAll(".ann-card").length;
    ok(n > 0, "announcements render cards (" + n + ")");
  }
  if (page === "backups.html") {
    const n = doc.querySelectorAll(".mirror").length;
    ok(n > 0, "backups render mirrors (" + n + ")");
  }
  if (page === "404.html") {
    ok(!!doc.querySelector(".not-found"), "404 renders its panel");
  }
  if (page.endsWith("index.html") && page !== "index.html") {
    ok(!!doc.querySelector("#libSearch") && !!doc.querySelector("#grid"), "library page mounts its controls");
  }
  if (page === "player.html") {
    ok(!!doc.querySelector(".player"), "player mounts its stage");
  }
  if (page === "settings.html") {
    const q = (s) => doc.querySelector(s);
    const fire = (el) => el.dispatchEvent(new win.Event("change", { bubbles: true }));
    ok(!!q("#perfSwitch") && !!q("#ultraSwitch"), "performance + ultra switches exist");
    ok(!!q("#cloakRedirectSwitch"), "cloak redirect switch exists");
    ok(!!q("#tabCustomUrl"), "custom tab has a real-site URL field");
    ok(
      /docs\.google\.com|Off|no real site/.test((q("#cloakTargetInfo") || {}).textContent || ""),
      "cloak target is spelled out in the row",
    );

    /* ultra: pref + <html> attribute, then back off again */
    const usw = q("#ultraSwitch");
    usw.checked = true;
    fire(usw);
    ok(
      win.N.prefs.get("perf") === "ultra" && doc.documentElement.dataset.perf === "ultra",
      "ultra switch sets data-perf=ultra",
    );
    ok(q("#perfSwitch").checked, "plain switch reads on while ultra is on");
    usw.checked = false;
    fire(usw);
    ok(
      win.N.prefs.get("perf") === true && doc.documentElement.dataset.perf === "1",
      "ultra off falls back to plain performance mode",
    );
    const psw = q("#perfSwitch");
    psw.checked = false;
    fire(psw);
    ok(win.N.prefs.get("perf") === false && !doc.documentElement.dataset.perf, "plain switch then clears it",);
    ok(!usw.checked, "ultra switch follows the pref back off");

    ok(typeof win.N.perf === "object" && typeof win.N.perf.ultra === "function", "N.perf.ultra() is exposed");
    ok(typeof win.N.cloak.target === "function", "cloak target is queryable");
    ok(typeof win.N.tab.url === "function" && /docs\.google\.com/.test(win.N.tab.url()), "the default preset has a real site");
  }

  ok(errors.length === 0, "no uncaught errors");
  win.close();
}

console.log(failed ? "\n" + failed + " check(s) failed" : "\nall page checks passed");
process.exit(failed ? 1 : 0);
