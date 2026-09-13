/* NULL · check-pages.js
   Smoke test for the real, multi-file site. Each page is loaded with its own
   stylesheets dropped and its scripts inlined, so jsdom (which has no network
   here, on purpose) still runs the page exactly as a browser loads it. Fails
   on any uncaught error and asserts the things that only exist once the
   page's script has run: nav/footer mounting, the tab preset taking over the
   title, the library/announcement/backup lists, and the settings controls
   (performance / ultra / cloak redirect) really applying their pref.

     node scripts/check-pages.js

   jsdom has no layout engine, so this checks behaviour and wiring: not how
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
    const stats = doc.querySelector("#mastStats");
    ok(!!stats && /game/.test(stats.textContent), "masthead shows the live catalog counts (\"" + (stats ? stats.textContent : "") + "\")");
    ok(!!doc.querySelector(".mast-quick a"), "masthead quick links render");
  }

  /* the dev console (type nldev) has to build, filter, and actually seed a
     library: it is the tool used to stress the grid */
  if (page === "games/index.html") {
    const dev = win.N && win.N.dev;
    ok(!!dev && typeof dev.show === "function", "dev console is exposed as N.dev");

    /* typing nldev has to ask for the password first */
    const type = (s) => {
      for (const ch of s) doc.dispatchEvent(new win.KeyboardEvent("keydown", { key: ch, bubbles: true }));
    };
    const submit = (field, value) => {
      field.value = value;
      const form = doc.querySelector(".dc-gate-box");
      form.dispatchEvent(new win.Event("submit", { bubbles: true, cancelable: true }));
    };
    type("nldev");
    ok(!!doc.querySelector(".dc-gate"), "typing nldev opens the password gate");
    if (doc.querySelector(".dc-gate")) {
      submit(doc.querySelector(".dc-gate-in"), "open-sesame");
      ok(/wrong password/i.test(doc.querySelector(".dc-gate-err").textContent), "a wrong password is refused");
      ok(!!doc.querySelector(".dc-gate"), "...and the gate stays up");
      submit(doc.querySelector(".dc-gate-in"), "mynameisblob123");
      ok(!!doc.querySelector(".dc-ov"), "the right password opens the console");
      await wait(260);
      ok(!doc.querySelector(".dc-gate"), "...and the gate is gone");
    }

    if (dev) {
      dev.show();
      const cards = doc.querySelectorAll(".dc-card").length;
      ok(cards >= 10, "dev console builds its tool cards (" + cards + ")");
      ok(!!doc.querySelector(".dc-find"), "dev console has a filter box");

      const find = doc.querySelector(".dc-find");
      find.value = "confetti";
      find.dispatchEvent(new win.Event("input"));
      const shown = Array.from(doc.querySelectorAll(".dc-card")).filter((c) => !c.hidden).length;
      const keptButtons = Array.from(doc.querySelectorAll(".dc-b")).filter((b) => !b.hidden).length;
      ok(shown === 1 && keptButtons === 2, "filtering keeps only the matches (" + shown + " card, " + keptButtons + " buttons)");
      find.value = "";
      find.dispatchEvent(new win.Event("input"));
      ok(Array.from(doc.querySelectorAll(".dc-card")).every((c) => !c.hidden), "clearing the filter restores every card");

      const before = win.N.catalog.games().length;
      const seedBtn = Array.from(doc.querySelectorAll(".dc-b")).find((b) => /250 games/.test(b.textContent));
      ok(!!seedBtn, "dev console has a \"250 games\" stress-test button");
      if (seedBtn) {
        seedBtn.click();
        const after = win.N.catalog.games().length;
        ok(after === before + 250, "seeding adds placeholders (" + before + " → " + after + ")");
        /* jsdom has no layout, so the virtual grid renders nothing to count:
           the library's own counter is the honest signal that it refreshed */
        const counter = doc.querySelector("#count");
        ok(!!counter && new RegExp(after + " / " + after).test(counter.textContent), "the library page re-counts itself (\"" + (counter ? counter.textContent : "") + "\")");
        const clear = Array.from(doc.querySelectorAll(".dc-b")).find((b) => /Clear placeholders/.test(b.textContent));
        if (clear) clear.click();
        ok(win.N.catalog.games().length === before, "clearing removes them again (" + win.N.catalog.games().length + ")");
      }

      const buttons = Array.from(doc.querySelectorAll(".dc-b"));
      ok(
        buttons.some((b) => /404 page/.test(b.textContent)) &&
          !buttons.some((b) => /Single-file/.test(b.textContent)),
        "the pages card links the 404 and no longer the single-file builds",
      );

      /* handing out coins has to survive a reload, not just look right */
      const coinsBtn = buttons.find((b) => /Add 200 coins/.test(b.textContent));
      ok(!!coinsBtn, "dev console has the coin button");
      if (coinsBtn) {
        coinsBtn.click();
        const eco = JSON.parse(win.localStorage.getItem("null:eco") || "{}");
        ok(eco.coins >= 200, "coins from the console are persisted (" + (eco.coins || 0) + ")");
      }
      dev.hide();
    }
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

/* ---------- icon font ----------
   The icon table has to hold codepoints, not the ligature names the glyphs came
   from. NULL ships a cut of the font with no letters in it (see
   scripts/build-font.js), so a name left written as words renders as nothing at
   all: worth catching here rather than by eye. */
console.log("\nicon font");
{
  const dom = fs.readFileSync(path.join(root, "src", "utilities", "dom.js"), "utf8");
  const table = dom.slice(dom.indexOf("var P = {"));
  const entries = [
    ...table.slice(0, table.indexOf("};")).matchAll(/(\w+):\s*"((?:\\.|[^"\\])*)"/g),
  ].map((m) => ({ name: m[1], value: JSON.parse('"' + m[2] + '"') }));
  const spelled = entries.filter(
    (e) => !(e.value.length === 1 && e.value.charCodeAt(0) >= 0xe000),
  );

  ok(entries.length > 20, "the icon table parsed (" + entries.length + " glyphs)");
  ok(
    spelled.length === 0,
    spelled.length
      ? "every icon is a codepoint: " + spelled.map((e) => e.name).join(", ") + ": run `bun run font`"
      : "every icon is a codepoint",
  );

  const font = "public/fonts/material-symbols-rounded.woff2";
  ok(fs.existsSync(path.join(root, font)), "the icon font is present");
  ok(
    fs.readFileSync(path.join(root, "src", "styles", "global.css"), "utf8").includes('url("/' + font + '")'),
    "global.css serves it locally",
  );
}

console.log(failed ? "\n" + failed + " check(s) failed" : "\nall page checks passed");
process.exit(failed ? 1 : 0);
