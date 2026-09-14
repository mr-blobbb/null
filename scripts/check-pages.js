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

/* the hidden pages: no page links to them, you get there by typing the
   address (or from the dev console's eggs card), so the list is the link */
const EGGS = ["void.html", "blob.html", "time.html", "credits.html"];

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
  "games/index.html",
  "apps/index.html",
  "proxies/index.html",
  "player.html",
  "404.html",
  ...EGGS,
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
  /* the eggs skip the tab preset on purpose: their own title stays put */
  if (page !== "player.html" && !EGGS.includes(page)) {
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

      /* the egg hooks: the blob face forces on then off, and the midnight
         button fires its modal without waiting for the clock */
      const orbBtn = buttons.find((b) => /Blob face on\/off/.test(b.textContent));
      ok(!!orbBtn, "dev console has the blob face toggle");
      if (orbBtn) {
        orbBtn.click();
        ok(!!doc.querySelector(".blob-orb"), "the toggle forces the blob face on");
        orbBtn.click();
        ok(!doc.querySelector(".blob-orb"), "...and forces it off again");
      }
      const midBtn = buttons.find((b) => /Midnight modal/.test(b.textContent));
      ok(!!midBtn, "dev console has the midnight modal button");
      if (midBtn) {
        midBtn.click();
        await wait(60);
        const title = (doc.querySelector(".modal-ov .modal h3") || {}).textContent || "";
        ok(/midnight/i.test(title), "the midnight button opens its modal (\"" + title + "\")");
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
  if (page === "void.html") {
    ok(!!doc.querySelector(".egg-void .await"), "void renders its one line");
    doc.querySelector(".egg-void").click();
    ok(doc.querySelectorAll(".egg-pop").length === 1, "clicking the void pops its reply");
  }
  if (page === "blob.html") {
    ok(doc.querySelectorAll(".blob-line").length > 0, "blob starts typing on load");
  }
  if (page === "time.html") {
    const line = (doc.querySelector(".clock") || {}).textContent || "";
    ok(/\d{1,2}:\d{2}:\d{2}/.test(line), "time paints a live clock (\"" + line + "\")");
    ok(!!doc.querySelector(".egg-time .win .lamp"), "time shows its open/closed window");
  }
  if (page === "credits.html") {
    ok(doc.querySelectorAll(".c-sec").length > 0, "credits roll has sections to scroll");
    doc.querySelector("#skip").click();
    ok(doc.querySelectorAll(".egg-pop").length === 1, "skip does not skip: it pops the joke");
  }
  if (page.endsWith("index.html") && page !== "index.html") {
    ok(!!doc.querySelector("#libSearch") && !!doc.querySelector("#grid"), "library page mounts its controls");
  }
  if (page === "player.html") {
    ok(!!doc.querySelector(".player"), "player mounts its stage");
  }
  if (page === "settings.html") {
    const q = (s) => doc.querySelector(s);
    const qa = (s) => Array.from(doc.querySelectorAll(s));
    const fire = (el) => el.dispatchEvent(new win.Event("change", { bubbles: true }));
    const tier = (v) => qa("#perfSeg button").find((b) => b.dataset.val === v);
    ok(qa("#perfSeg button").length === 3, "the performance tiers are listed");

    /* the page is a rail of sections beside grouped, foldable cards */
    const links = qa("#railList .rail-link");
    ok(links.length >= 4, "the rail has one link per section (" + links.length + ")");
    ok(links.length === qa(".set-group").length, "…and that is every group on the page");
    ok(
      links.every((l) => doc.getElementById(l.dataset.target)),
      "every rail link points at a real section",
    );
    ok(qa("[data-fold]").length >= 6, "the set-once cards fold (" + qa("[data-fold]").length + ")");

    const glowCard = q('[data-fold="glow"]');
    const glowBtn = glowCard.querySelector(".set-toggle");
    ok(glowCard.getAttribute("data-open") === "0", "the glow card starts folded");
    glowBtn.click();
    ok(
      glowCard.getAttribute("data-open") === "1" && glowBtn.getAttribute("aria-expanded") === "true",
      "clicking its header opens it",
    );
    ok(JSON.parse(win.localStorage.getItem("null:setFolds")).glow === 1, "…and the fold is remembered");
    glowBtn.click();
    ok(glowCard.getAttribute("data-open") === "0", "clicking again folds it back");

    /* the rail filter matches card text, opens what it finds, and clears */
    const find = q("#setFind");
    find.value = "confetti";
    find.dispatchEvent(new win.Event("input", { bubbles: true }));
    await wait(200);
    const live = qa("[data-card]:not(.gone)");
    ok(live.length === 1 && live[0].dataset.card === "extras", "filtering keeps only the matching card");
    ok(q("#setEnd").hidden, "a hit means no empty state");
    find.value = "";
    find.dispatchEvent(new win.Event("input", { bubbles: true }));
    await wait(200);
    ok(qa("[data-card]:not(.gone)").length === qa("[data-card]").length, "clearing the filter shows everything");

    /* theme is one switch now */
    const themeSw = q("#themeSwitch");
    ok(!!themeSw && !q("#themeSeg"), "theme is a single switch, not two buttons");
    themeSw.checked = true;
    fire(themeSw);
    ok(
      win.N.prefs.get("theme") === "light" && doc.documentElement.dataset.theme === "light",
      "the theme switch flips to light",
    );
    themeSw.checked = false;
    fire(themeSw);
    ok(doc.documentElement.dataset.theme === "dark", "…and back to dark");

    ok(!!q("#cloakRedirectSwitch"), "cloak redirect switch exists");
    ok(!!q("#tabCustomUrl"), "custom tab has a real-site URL field");
    ok(
      /docs\.google\.com|Off|no real site/.test((q("#cloakTargetInfo") || {}).textContent || ""),
      "cloak target is spelled out in the row",
    );

    /* the tier segment drives the pref, the <html> attribute and its own note */
    tier("ultra").click();
    ok(
      win.N.prefs.get("perf") === "ultra" && doc.documentElement.dataset.perf === "ultra",
      "the Ultra tier sets data-perf=ultra",
    );
    ok(tier("ultra").classList.contains("on"), "the chosen tier reads as selected");
    ok(/no particles, no glow/.test(q("#perfNote").textContent), "…and the note says what it does");
    tier("on").click();
    ok(
      win.N.prefs.get("perf") === true && doc.documentElement.dataset.perf === "1",
      "the Performance tier falls back to plain performance mode",
    );
    tier("off").click();
    ok(win.N.prefs.get("perf") === false && !doc.documentElement.dataset.perf, "the Off tier clears it");
    ok(tier("off").classList.contains("on"), "…and reads as the selected tier");

    /* density: one scale on <html>, and it goes back off */
    const dseg = q("#densitySeg");
    ok(!!dseg && dseg.querySelectorAll("button").length === 4, "four compactness options exist");
    const compact = Array.from(dseg.querySelectorAll("button")).find((b) => b.dataset.val === "compact");
    compact.click();
    ok(
      win.N.prefs.get("density") === "compact" && doc.documentElement.dataset.density === "compact",
      "compact sets html[data-density=compact]",
    );
    dseg.querySelector("button").click();
    ok(!doc.documentElement.dataset.density, "regular clears the density attribute");

    /* mini-perf: same attribute deal, nothing else touched */
    const mp = q("#miniPerfSwitch");
    mp.checked = true;
    fire(mp);
    ok(
      win.N.prefs.get("miniPerf") === true && doc.documentElement.dataset.mini === "1",
      "Mini-Perf sets html[data-mini=1]",
    );
    ok(!doc.documentElement.dataset.perf, "Mini-Perf never turns performance mode on");
    mp.checked = false;
    fire(mp);
    ok(!doc.documentElement.dataset.mini, "Mini-Perf off clears it");

    /* the season picker offers the season and its holiday together */
    const seasonBtns = Array.from(q("#seasonSeg").querySelectorAll("button"));
    const seasonIds = seasonBtns.map((b) => b.dataset.val);
    ok(
      seasonIds.indexOf("fall") >= 0 && seasonIds.indexOf("halloween") >= 0,
      "Fall and Halloween are offered together (" + seasonIds.filter(Boolean).join(", ") + ")",
    );
    seasonBtns.find((b) => b.dataset.val === "halloween").click();
    ok(
      win.N.prefs.get("seasonVariant") === "halloween" && doc.documentElement.dataset.season === "halloween",
      "picking Halloween wears it",
    );

    /* the background image is a Shop unlock: locked here, and the controls
       only appear once it is owned */
    ok(!!q("#bgUrl") && q("#bgBody").hidden, "background controls stay hidden while locked");
    win.N.econ.grant("fx", "custombg");
    win.N.bus.emit("sync");
    win.N.theme.setBg({ bgImage: "https://example.com/wall.png", bgFit: "tile", bgDim: 0.5 });
    const bg = doc.querySelector(".bg-fx");
    ok(!!bg && bg.style.backgroundImage.indexOf("wall.png") > 0, "the background layer takes the picture");
    ok(!!bg && bg.style.backgroundRepeat === "repeat", "…and its fit");
    win.N.theme.setBg({ bgImage: "" });
    ok(!doc.querySelector(".bg-fx"), "removing the picture drops the layer");

    /* the editor: one fx unlock, and with it the crafted pack + particle set
       become real, ownable definitions */
    ok(win.N.econ.isUnlocked("theme", "mypack") === false, "no crafted pack before the editor is owned");
    ok(!!q("#openEditor") && !!win.N.editor, "the editor button and module are on the page");
    win.N.econ.grant("fx", "editor");
    win.N.bus.emit("sync");
    ok(
      win.N.econ.isUnlocked("theme", "mypack") && win.N.econ.isUnlocked("particle", "mypart"),
      "owning the editor owns what it builds",
    );
    const packsBefore = win.N.theme.allPacks().length;
    win.N.theme.craftWrite({
      pack: { name: "Check pack", art: "aurora", colors: ["#111", "#222", "#333", "#444"], tint: ["#050505", "#000"], parts: [{ k: "star", n: 8, sp: "spread" }] },
      part: { name: "Check bits", mono: true, colors: ["#aaa", "#bbb", "#ccc", "#ddd"], parts: [{ k: "mote", n: 8, sp: "bottom" }] },
    });
    ok(win.N.theme.allPacks().length === packsBefore + 1, "a crafted pack joins the pack list");
    ok(win.N.theme.allParticles().some((p) => p.id === "mypart"), "a crafted particle set joins the particle list");
    win.N.theme.setAccent("mypack");
    const cfx = doc.querySelector(".pack-fx");
    ok(!!cfx && !!cfx.querySelector(".pf-p-star b"), "the crafted pack draws its borrowed art and its parts");
    win.N.theme.setAccent("off");

    /* your own pair gets a card each, with circles you can recolour and a
       delete button, without opening the editor */
    win.N.bus.emit("sync"); /* the page repaints its grids */
    const own = qa("#packGrid .pack-card.crafted");
    ok(own.length === 1, "your own pack gets a card of its own");
    ok(
      own[0].querySelectorAll(".craft-tools .cdot").length === 6,
      "…with four palette circles and two tint circles",
    );
    const dots = own[0].querySelectorAll(".craft-tools .cdot input[type=color]");
    ok(dots.length === 6, "every circle owns a real colour input");
    dots[0].value = "#123456";
    dots[0].dispatchEvent(new win.Event("input", { bubbles: true }));
    ok(win.N.theme.craftPack().colors[0] === "#123456", "picking a colour writes it back to the pack");
    ok(
      own[0].querySelector(".pack-strip i").style.background !== "",
      "…and the colour strip follows it",
    );

    const ownPart = qa("#partGrid .pack-card.crafted")[0];
    ok(
      !!ownPart && !!ownPart.querySelector(".craft-tools .switch"),
      "your particle set can follow the theme colours or carry its own",
    );
    ok(!!own[0].querySelector(".craft-tools .btn-outline-danger"), "your own pack can be deleted from the card");

    win.N.theme.setAccent("mypack");
    win.N.theme.removeCraft("pack");
    ok(win.N.theme.allPacks().every((p) => p.id !== "mypack"), "deleting it removes it for good");
    ok(win.N.prefs.get("accent") !== "mypack", "…and un-wears it");
    win.N.theme.removeCraft("part");
    ok(win.N.theme.allParticles().every((p) => p.id !== "mypart"), "deleting your particle set removes it too");

    /* the custom accent is one big colour circle, not a bare swatch */
    win.N.econ.grant("fx", "customaccent");
    win.N.bus.emit("sync");
    ok(
      !!q('#accentRow .swatch-btn[data-val="custom"]'),
      "owning the custom accent adds its swatch while the page is open",
    );
    const accDot = q("#accentCustomRow .cdot input[type=color]");
    ok(!!accDot, "the custom accent is a colour circle with a real picker behind it");
    accDot.value = "#ff0090";
    accDot.dispatchEvent(new win.Event("input", { bubbles: true }));
    ok(
      win.N.prefs.get("accentColor") === "#ff0090" && win.N.prefs.get("accent") === "custom",
      "picking a colour sets the custom accent",
    );
    ok(qa("#glowColors .cdot").length === 2, "the custom glow colours are circles too");

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

/* ---------- [data-icon] placeholders ----------
   shell.js hydrates every [data-icon] element in place. On a <span> it swaps
   the span out; on anything else it empties the element first and drops an
   icon in, so a placeholder left on a <section> or a <div> wipes whatever was
   inside it. That is a whole card silently disappearing, which is exactly the
   kind of bug this file exists to catch. */
console.log("\nicon placeholders");
{
  const skip = new Set(["node_modules", ".git", "releases", "public", "scripts"]);
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) files.push(p);
    }
  })(root);

  const bad = [];
  for (const f of files) {
    const html = fs.readFileSync(f, "utf8");
    for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*\bdata-icon=/g)) {
      if (m[1].toLowerCase() !== "span") bad.push(path.relative(root, f) + " puts it on a <" + m[1] + ">");
    }
  }
  ok(
    bad.length === 0,
    bad.length ? bad.join("; ") : "every [data-icon] placeholder sits on a <span> (" + files.length + " pages)",
  );
}

console.log(failed ? "\n" + failed + " check(s) failed" : "\nall page checks passed");
process.exit(failed ? 1 : 0);
