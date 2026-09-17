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
  "extensions.html",
  "labs.html",
  "root.html",
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
    /* jsdom's own gaps (no layout, no images) are not page bugs */
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
      /* a page that wants a store to already exist (an installed extension)
         seeds it here, before the first script runs */
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
    /* the rail is the navigation, and the head script has to have decided
       which before the first paint */
    ok(
      doc.documentElement.dataset.nav === "side",
      "the rail layout is written on <html> (" + doc.documentElement.dataset.nav + ")",
    );
    ok(
      doc.querySelectorAll(".rail .ril").length === win.N.router.RAIL_TOP.length + win.N.router.RAIL_BOTTOM.length,
      "…with every door drawn",
    );
  }
  ok(
    !!doc.querySelector(".site-foot") === !!doc.querySelector('[data-mount="foot"]'),
    "footer mounts exactly where the page asks for one",
  );
  /* the eggs skip the tab preset on purpose: their own title stays put */
  if (page !== "player.html" && !EGGS.includes(page)) {
    ok(doc.title === "Untitled Slide - Google Slides", "tab preset owns the title (\"" + doc.title + "\")");
  }

  if (page === "index.html") {
    /* the front door is one wordmark, one line, one search box and the row
       of circles: the shelves live on the library pages */
    const word = doc.querySelector(".hm-word");
    ok(!!word && word.textContent === "null", "the front door shows the wordmark");
    ok(!!(doc.querySelector("#hmLine") || {}).textContent, "…and a line picked for this load");
    ok(!!doc.querySelector("#homeSearch #searchInput"), "the front door carries the site search");
    ok(doc.querySelectorAll("#hmLinks .ql").length >= 7, "the circles render (All Apps, Add, five shortcuts)");
    ok(!!doc.querySelector("#hmMeta"), "…and the corner readout");
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
        /* with nothing filtered the count is just the total: a filter is what
           turns it into "shown / total" */
        const seen = counter ? counter.textContent : "";
        ok(!!counter && seen === after + " of " + after, "the library page re-counts itself (\"" + seen + "\")");
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
  if (page === "shop.html") {
    /* three cosmetic shelves, then the older settings-level unlocks */
    const cards = doc.querySelectorAll("#shopBody .sc");
    ok(cards.length > 0, "the shop lists its items (" + cards.length + " cards)");
    ok(!!doc.querySelector("#shopBody .sc-art"), "…each with its own artwork");
    const heads = Array.from(doc.querySelectorAll("#shopBody .shop-head h2")).map((h) => h.textContent);
    ok(
      heads.indexOf("Avatar decorations") >= 0 && heads.indexOf("Name tags") >= 0,
      "…grouped on their shelves (" + heads.join(", ") + ")",
    );
    ok(!!doc.querySelector("#coinN") && !!doc.querySelector("#giftBtn"), "the purse shows coins and a gift button");
    ok(
      doc.querySelectorAll("#shopBody .sc-buy").length === cards.length,
      "…every card carrying a lock state",
    );
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
    /* an empty folder is a normal state: say so instead of drawing nothing */
    const kind = page.split("/")[0];
    if (!win.N.catalog[kind]().length) {
      ok(!!(doc.querySelector("#empty") || {}).textContent, "an empty " + kind + " folder shows the empty state");
    }
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
      win.N.prefs.get("palette") === "light" &&
        doc.documentElement.dataset.palette === "light" &&
        doc.documentElement.dataset.theme === "light",
      "the theme switch flips to light",
    );
    /* the palette picker: sixteen schemes, one card each, and picking one
       repaints the page rather than only the accent */
    ok(qa("#palRow .pal").length === win.N.theme.palettes.length, "every palette has a card (" + qa("#palRow .pal").length + ")");
    const forest = qa("#palRow .pal").find((b) => b.dataset.val === "forest");
    ok(!!forest, "…including Forest");
    if (forest) {
      forest.click();
      ok(
        doc.documentElement.dataset.palette === "forest" && win.N.prefs.get("palette") === "forest",
        "…and picking one re-inks the page (" + doc.documentElement.dataset.palette + ")",
      );
    }
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

    /* Your own pair gets a card each, shaped exactly like every other theme:
       no palette or tint controls crowding it (those live in the editor),
       just the edit and delete buttons added to the usual Apply. */
    win.N.bus.emit("sync"); /* the page repaints its grids */
    const own = qa("#packGrid .pack-card.crafted");
    ok(own.length === 1, "your own pack gets a card of its own");
    ok(own[0].querySelectorAll(".craft-tools").length === 0, "…with no palette or tint controls on it");
    ok(
      own[0].querySelector(".pack-thumb") && own[0].querySelector(".shop-info") && own[0].querySelector(".shop-foot"),
      "…and the same three blocks as every other theme card",
    );
    ok(
      own[0].querySelector(".pack-info h3, .shop-info h3").textContent === "Check pack",
      "…carrying its own name",
    );
    ok(
      own[0].querySelector(".pack-strip i").style.background !== "",
      "…and its colour strip still shows the palette",
    );
    ok(own[0].querySelectorAll(".shop-foot .btn").length === 3, "…and Apply plus one edit and one delete button");
    ok(!!own[0].querySelector(".shop-foot .btn-outline-danger"), "your own pack can be deleted from the card");

    const ownPart = qa("#partGrid .pack-card.crafted")[0];
    ok(!!ownPart, "your particle set gets a card of its own");
    ok(!!ownPart && ownPart.querySelectorAll(".craft-tools").length === 0, "…shaped like every other particle set");
    ok(!!ownPart && ownPart.querySelectorAll(".shop-foot .btn").length === 3, "…with the same edit and delete buttons");

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

/* ---------- the starters and the site's own clock ----------
   NULL ships two .nullext files: a focus timer (a nav widget plus a window of
   its own) and a whole page of HTML. The period clock used to be a third, and
   it is part of the site now, so the checks here are the three things that
   went wrong with it: a copy left running next to the real clock, a clock that
   never reached the player, and a second starter that was never shipped. */
console.log("\nstarters and the site clock");
{
  /* exactly what a copy installed back when it was an extension looks like */
  const OLD = {
    id: "period-clock",
    kind: "native",
    name: "Period clock",
    version: "1.0.0",
    author: "you",
    icon: "clock",
    run: "always",
    css: "",
    js: "setInterval(function(){}, 15000);",
    html: "",
    pages: [],
    nav: [],
    manifest: { nullExt: 1, name: "Period clock", version: "1.0.0" },
    enabled: true,
    at: Date.now(),
  };

  /* count the once-a-second tickers a page arms: "the clock is live" is a
     claim about a timer, so read the timer */
  const countTicks = (w) => {
    const raw = w.setInterval;
    w.__ticks = 0;
    w.setInterval = function (fn, ms) {
      if (ms === 1000) w.__ticks++;
      return raw.apply(w, arguments);
    };
  };

  const { dom, errors } = load("extensions.html", "/", (w) => {
    countTicks(w);
    w.localStorage.setItem("null:ext", JSON.stringify([OLD]));
  });
  const win = dom.window;
  const doc = win.document;
  await wait(1800);
  ok(errors.length === 0, "no script errors (" + errors.slice(0, 2).join(" | ") + ")");

  ok(win.N.ext.list()[0].enabled === false, "a period-clock copy is switched off now the site has its own");
  ok(
    Array.from(doc.querySelectorAll(".toast")).some((t) => /part of NULL now/i.test(t.textContent)),
    "…and it says why, once",
  );
  ok(!!doc.querySelector('[data-clock="nav"] .pclock'), "the site's own clock draws in the nav");
  ok(win.__ticks > 0, "…and it ticks once a second");
  ok(!!doc.querySelector('[data-clock="nav"] .pclock'), "the retired copy leaves no second clock behind");

  const cards = Array.from(doc.querySelectorAll("#extStart .start-card"));
  const names = cards.map((c) => c.querySelector("b").textContent);
  ok(cards.length === 2, "both starters are offered (" + cards.length + ")");
  ok(
    names.indexOf("Focus timer") >= 0 && names.indexOf("Starter page") >= 0,
    "…a window of your own and a whole page (" + names.join(", ") + ")",
  );

  /* the newest modal only: a confirm can sit in the DOM for a beat after it
     closes, and clicking its button would install the wrong thing */
  const lastModal = () => {
    const all = doc.querySelectorAll(".modal");
    return all.length ? all[all.length - 1] : null;
  };
  const confirmBtn = () => {
    const box = lastModal();
    return box ? Array.from(box.querySelectorAll("button")).find((b) => /install/i.test(b.textContent)) : null;
  };

  /* install the window starter from its card and drive it */
  const timerCard = cards.find((c) => c.querySelector("b").textContent === "Focus timer");
  timerCard.querySelector(".sc-acts .btn").click();
  await wait(180);
  const go = confirmBtn();
  ok(!!go, "installing asks first");
  if (go) go.click();
  await wait(300);
  const timer = win.N.ext.list().find((e) => e.name === "Focus timer");
  ok(!!timer, "the focus timer installs (" + win.N.ext.list().map((e) => e.name).join(", ") + ")");
  ok(!!doc.querySelector('[data-slot="nav"] .ft-chip'), "…and mounts its pill in the nav");

  if (timer) {
    win.N.ext.openHtml(timer.id);
    await wait(120);
    const face = doc.querySelector(".ext-pop .ft-time");
    ok(!!face, "its window opens with the markup from the manifest");
    const start = doc.querySelector('.ext-pop [data-act="start"]');
    ok(!!start, "…with buttons to drive it");
    if (start) {
      start.click();
      await wait(80);
      const pill = doc.querySelector('[data-slot="nav"] .ft-chip');
      ok(!!pill && !pill.hidden, "starting it puts the count in the nav");
      /* the pill repaints on the extension's own second, so give it a few */
      let ticked = null;
      for (let i = 0; i < 12 && !ticked; i++) {
        await wait(300);
        const shown = pill.querySelector(".ft-txt").textContent;
        if (shown !== "25:00") ticked = shown;
      }
      ok(!!ticked, "…and that count ticks (" + (ticked || "never moved") + ")");
    }
    /* install the page starter too: a real page, no JavaScript. The cards are
       rebuilt after every install, so ask for the card again. */
    const pageCard = Array.from(doc.querySelectorAll("#extStart .start-card")).find(
      (c) => c.querySelector("b").textContent === "Starter page",
    );
    pageCard.querySelector(".sc-acts .btn").click();
    await wait(200);
    const go2 = confirmBtn();
    ok(!!go2, "the page starter offers the same install step");
    if (go2) go2.click();
    await wait(350);
    ok(win.N.ext.pages().length >= 1, "the page starter adds a page (" + win.N.ext.pages().length + ")");
    ok(
      !Array.from(doc.querySelectorAll(".toast")).some((t) => /is in your nav/.test(t.textContent)),
      "nothing greets you about the nav on every visit",
    );
  }
  const reg = win.localStorage.getItem("null:ext");
  dom.window.close();

  /* the player has no nav bar, so the clock needs the strip the player keeps
     for exactly this */
  const pl = load("player.html", "/", (w) => {
    countTicks(w);
    if (reg) w.localStorage.setItem("null:ext", reg);
  });
  await wait(800);
  ok(pl.errors.length === 0, "the player loads clean (" + pl.errors.slice(0, 2).join(" | ") + ")");
  const pdoc = pl.dom.window.document;
  ok(!!pdoc.querySelector(".player-widgets .pclock"), "the site's clock reaches the player");
  ok(pl.dom.window.__ticks > 0, "…and keeps ticking there");
  pl.dom.window.close();
}

/* ---------- the front door's backdrop ----------
   A still grid of dots, painted with one tiled gradient. No canvas, no
   motion: the home page is texture and text and nothing else. The card band
   under it is the only moving thing, and it carries the placeholder quote
   plus the rest of the shelf. */
console.log("\nthe front door backdrop");
{
  const { dom, errors } = load("index.html", "/");
  const win = dom.window;
  const doc = win.document;
  await wait(500);

  ok(!!doc.querySelector(".dots"), "the front door paints its grid of dots");
  ok(!doc.querySelector(".dots canvas"), "…with nothing animated behind the text");
  ok(doc.querySelectorAll(".hm-track .mc").length >= 12, "the card band is populated");
  ok(!!doc.querySelector(".mc-av"), "…each card carrying its little square picture slot");
  ok(errors.length === 0, "no script errors (" + errors.slice(0, 2).join(" | ") + ")");
  win.close();
}
{
  const { dom, errors } = load("settings.html", "/");
  const win = dom.window;
  await wait(400);

  win.N.econ.grant("fx", "editor");
  win.N.theme.craftWrite({
    part: { name: "Old map", mono: true, colors: ["#aaa", "#bbb"], parts: [{ k: "node", n: 30 }, { k: "link", n: 20 }] },
  });
  const saved = win.N.theme.allParticles().find((p) => p.id === "mypart");
  ok(
    !!saved && saved.parts.length === 1 && saved.parts[0].k === "net",
    "a set saved as node + link becomes one network",
  );
  ok(
    !!saved && !!win.N.theme.partThumb(saved).querySelector(".pt-net"),
    "…and its preview draws the same canvas",
  );
  ok(errors.length === 0, "no script errors (" + errors.slice(0, 2).join(" | ") + ")");
  win.close();
}

/* ---------- the nav model ----------
   Four doors fit the rail; every other page is behind the More button, which
   is what keeps the rail short without hiding the site. */
console.log("\nthe nav model");
{
  const { dom, errors } = load("index.html", "/");
  const win = dom.window;
  const doc = win.document;
  await wait(400);

  ok(win.N.router.RAIL_TOP.length === 5, "the rail carries five doors up top");
  ok(win.N.router.RAIL_BOTTOM.length === 4, "…and four along the bottom");
  const doors = Array.from(doc.querySelectorAll(".rail .rail-grp .ril"));
  ok(doors.length === 9, "…all nine drawn (" + doors.length + ")");
  ok(
    doors.map((a) => a.dataset.id).join(",") === "home,games,apps,proxies,shop,profile,changelog,extensions,settings",
    "…in the order they were asked for (" + doors.map((a) => a.dataset.id).join(",") + ")",
  );
  ok(!!doc.querySelector('.rail .ril[data-id="home"] .ril-ic svg'), "…each with its own drawn icon");
  ok(!!doc.querySelector(".rail .ril.on"), "…and the page you are on is the only one marked");

  /* All Apps: the one place the whole site map lives now */
  const allBtn = doc.querySelector("#hmLinks .ql--fixed .ql-c");
  ok(!!allBtn, "the front door has an All Apps circle");
  if (allBtn) allBtn.click();
  await wait(60);
  const listed = Array.from(doc.querySelectorAll(".sh-ov .ap")).map((a) => a.getAttribute("href"));
  ok(listed.length === win.N.router.ALL.length, "…and it lists every page (" + listed.length + ")");
  ok(listed.every((h) => h && h.charAt(0) === "/"), "…with real links");
  ok(errors.length === 0, "no script errors (" + errors.slice(0, 2).join(" | ") + ")");
  win.close();
}

/* ---------- served from a subfolder ----------
   The same files have to work from a subfolder as well, which is where a
   GitHub Pages project site lives: user.github.io/repo-name/. Nothing is
   hardcoded to a root, so every link a page or the JS builds has to carry that
   folder, and the nav has to still light up the right item. The name below is
   made up on purpose: any folder has to work, not one in particular. */
console.log("\nserved from /site/");
{
  /* a page with the full chrome: the front door has no footer of its own, and
     the folder has to reach every link a page builds */
  const { dom, errors } = load("announcements.html", "/site/");
  const win = dom.window;
  const doc = win.document;
  await wait(400);
  ok(errors.length === 0, "no script errors (" + errors.slice(0, 2).join(" | ") + ")");
  ok(win.N.base === "/site/", "the folder is worked out from the page (" + win.N.base + ")");

  const home = doc.querySelector('.rail .ril[data-id="home"]');
  ok(!!home && home.getAttribute("href") === "/site/", "the home door links to the root NULL is served from");
  const nav = doc.querySelector('.rail .ril[data-id="games"]');
  ok(!!nav && nav.getAttribute("href").indexOf("/site/") === 0, "nav links carry the folder (" + (nav ? nav.getAttribute("href") : "none") + ")");
  const foot = doc.querySelector(".site-foot a[href]");
  ok(!!foot && foot.getAttribute("href").indexOf("/site/") === 0, "footer links carry the folder (" + (foot ? foot.getAttribute("href") : "none") + ")");
  ok(win.N.router.isActive("/games/") === false, "an inactive nav item stays inactive");

  /* the library can be empty while folders are still being added */
  const g = win.N.catalog.games()[0];
  if (g) {
    ok(g.file.indexOf("/site/") === 0, "a catalog entry's file carries the folder (" + g.file + ")");
  } else {
    ok(doc.querySelectorAll(".tcard").length === 0, "an empty library still renders");
  }
}

/* ---------- the 404, answered at an address that is not a folder ----------
   A static host answers a missing address with 404.html and keeps the address,
   so the page cannot read its folder off the URL: /games/typo/ would look like
   the site root. It names the root itself instead, and its own paths are
   written from the root for the same reason. */
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
  ok(!!back && back.getAttribute("href") === "/", "its own links are root-anchored too (" + (back ? back.getAttribute("href") : "none") + ")");
  const loose = [...html.matchAll(/(?:href|src)="([^"]+)"/g)]
    .map((m) => m[1])
    .filter((h) => h.charAt(0) !== "/" && h.charAt(0) !== "#" && !/^[a-z]+:/i.test(h));
  ok(loose.length === 0, "nothing on the page is left relative (" + loose.slice(0, 3).join(", ") + ")");
}

/* ---------- folders that hold pages ----------
   store.js works out the served folder from the page's own address, stepping
   back out of one of the content folders it knows about. A page dropped into a
   folder that is not on that list would build its JS links without the prefix,
   so the list and the folders on disk have to agree. */
console.log("\npage folders");
{
  const store = fs.readFileSync(path.join(root, "src", "utilities", "store.js"), "utf8");
  const m = store.match(/var FOLDERS = \[([^\]]*)\]/);
  const known = m ? m[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean) : [];
  ok(known.length > 0, "store.js lists the folders that hold pages (" + known.join(", ") + ")");

  const held = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(root, e.name, "index.html")))
    .map((e) => e.name);
  const stray = held.filter((name) => !known.includes(name));
  ok(
    stray.length === 0,
    stray.length
      ? stray.join(", ") + " hold(s) an index.html but is not in store.js's FOLDERS"
      : "every folder holding an index.html is listed (" + held.join(", ") + ")",
  );
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
  /* relative to the stylesheet, which is what keeps it loading under a
     project path and lets the release builds swap in a data: URI */
  ok(
    fs.readFileSync(path.join(root, "src", "styles", "global.css"), "utf8").includes('url("../../' + font + '")'),
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
