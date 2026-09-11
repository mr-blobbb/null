/* Verify the shop + local economy, the unread nav dot on library pages, the
   home tip card / "new since your last visit" strip, and the player's branded
   boot spinner — all against the real source files, in jsdom. */
const fs = require("fs");
const vm = require("vm");
const { JSDOM } = require("jsdom");

let failures = 0;
function check(name, ok) {
  console.log((ok ? "ok  " : "FAIL") + "  " + name);
  if (!ok) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* pull one CSS rule block out of a stylesheet, so a check can look inside it */
function rule(css, sel) {
  const i = css.indexOf(sel);
  if (i < 0) return "";
  const open = css.indexOf("{", i);
  const close = css.indexOf("}", open);
  return open < 0 || close < 0 ? "" : css.slice(open, close);
}

function makeDom(html, url, seed) {
  const dom = new JSDOM(html, {
    url: url,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("no fetch"));
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      if (seed) Object.keys(seed).forEach((k) => window.localStorage.setItem(k, seed[k]));
    },
  });
  const errs = [];
  dom.window.addEventListener("error", (e) => errs.push(String(e.message || e.error)));
  const ctx = dom.getInternalVMContext();
  const run = (file) => vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });
  return { dom, w: dom.window, run, errs };
}

/* ---------------------------------------------------------------- *
 * Part A — economy math: playtime → XP → coins → purchases          *
 * ---------------------------------------------------------------- */
function partA() {
  const { w, run } = makeDom("<!doctype html><body><p>eco</p>", "http://localhost:5173/shop");
  run("src/utilities/store.js");
  run("src/utilities/econ.js");
  run("src/content/content.js");
  const N = w.N;

  check("economy starts empty", N.econ.state().xp === 0 && N.econ.state().coins === 0);
  N.econ.bank(1799);
  check("no XP before a full 30 minutes", N.econ.state().xp === 0);
  N.econ.bank(1);
  check("30 minutes banks 10 XP", N.econ.state().xp === 10);
  check("no coins before 100 XP", N.econ.state().coins === 0);
  const got = N.econ.bank(9 * 1800);
  check("100 XP milestone banks 30 coins", N.econ.state().coins === 30 && got.coins === 30);
  check("playtime tracked in seconds", N.econ.state().time === 10 * 1800);

  const poor = N.econ.buy("theme", "matrix");
  check("cannot buy without coins", poor.ok === false && poor.reason === "not enough coins");
  N.econ.bank(10 * 1800); // +100 XP → 60 coins total
  check("second milestone banked 60 coins", N.econ.state().coins === 60 && N.econ.state().xp === 200);

  const buy = N.econ.buy("theme", "matrix");
  check("buy succeeds and unlocks", buy.ok === true && N.econ.isUnlocked("theme", "matrix") === true);
  check("coins deducted on purchase", N.econ.state().coins === 0);
  const again = N.econ.buy("theme", "matrix");
  check("duplicate purchase rejected", again.ok === false && again.reason === "already owned");

  N.econ.bank(10 * 1800); // +100 XP → 30 coins
  const boost = N.econ.buy("boost", "xpboost");
  check("XP boost purchasable", boost.ok === true && N.econ.state().boosted === true);
  const xp = N.econ.state().xp;
  N.econ.bank(1800);
  check("boost doubles XP (20 per 30 min)", N.econ.state().xp === xp + 20);

  check("locked beta starts locked", N.econ.isUnlocked("game", "beta-simon") === false);
  check("unlockedBetas hides locked betas", N.econ.unlockedBetas().length === 0);

  /* the dev console grants unlocks without charging — backdrops stay testable */
  N.econ.grant("theme", "cosmos");
  N.econ.grant("theme", "cosmos");
  check("dev grant unlocks a pack", N.econ.isUnlocked("theme", "cosmos") === true);
  check("grant does not charge coins", N.econ.state().coins === 0);

  /* free packs ship unlocked, and can't be bought */
  check("2 free packs exist", N.econ.FREE_PACKS.length === 2);
  check("free packs start unlocked", ["dawn", "mist"].every((id) => N.econ.isUnlocked("theme", id) === true));
  check("free packs are not purchasable", N.econ.buy("theme", "dawn").reason === "free");
  /* Graphite is gone; Neon replaced it as a shop-only pack */
  check("graphite is gone", ![...N.econ.FREE_PACKS, ...N.econ.THEMES].some((p) => p.id === "graphite"));
  const neon = N.econ.THEMES.find((t) => t.id === "neon");
  check("neon is a shop pack", !!neon && !neon.free);
  check("neon costs more than every other pack", neon.price > Math.max(...N.econ.THEMES.filter((t) => t.id !== "neon").map((t) => t.price)));
  check("neon is not unlocked until it's bought", N.econ.isUnlocked("theme", "neon") === false);
  check("neon is drawn from the glow palette", neon.glowAccent === true);

  /* Part B — unlocked beta merges into the live library */
  const b = makeDom("<!doctype html><body><p>lib</p>", "http://localhost:5173/shop");
  b.run("src/utilities/store.js");
  b.run("src/utilities/econ.js");
    b.run("src/utilities/dom.js");
  b.run("src/content/content.js");
  b.run("src/catalog/generated-catalog.js");
  b.run("src/catalog/catalog.js");
  const BN = b.w.N;
  const base = BN.catalog.games().length;
  check("betas stay out of the library until bought", BN.catalog.games().every((g) => g.id.indexOf("beta-") !== 0));
  BN.econ.bank(40 * 1800); // 400 XP → 120 coins
  check("400 XP banks 120 coins", BN.econ.state().coins === 120);
  const pb = BN.econ.buy("game", "beta-simon");
  check("beta game purchasable", pb.ok === true);
  check("bought beta joins the library", BN.catalog.games().length === base + 1);
  check("bought beta is findable", !!BN.catalog.find("game", "beta-simon"));
  check("unlockedBetas returns it", BN.econ.unlockedBetas().length === 1);
}

/* ---------------------------------------------------------------- *
 * Part C — the shop page renders + buys                             *
 * ---------------------------------------------------------------- */
function injectPage(file) {
  let html = fs.readFileSync(file, "utf8");
  const css = fs.readFileSync("src/styles/global.css", "utf8") + "\n" + fs.readFileSync("src/styles/extra.css", "utf8");
  html = html.replace(/<link rel="stylesheet" href="\/src\/styles\/extra\.css">/, "");
  html = html.replace('<link rel="stylesheet" href="/src/styles/global.css">', "<style>" + css + "</style>");
  return html.replace(/<script src="(\/src\/[^"]+)"><\/script>/g, (m, src) => {
    const p = src.split("?")[0].replace(/^\//, "");
    if (!fs.existsSync(p)) return "";
    return "<script>" + fs.readFileSync(p, "utf8") + "</script>";
  });
}

async function partC() {
  const eco = "null:eco";
  const dom = new JSDOM(injectPage("shop.html"), {
    url: "http://localhost:5173/shop",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("no fetch"));
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.localStorage.setItem(
        eco,
        JSON.stringify({
          time: 3600,
          xp: 200,
          coins: 120,
          next: 300,
          pend: 0,
          boostUntil: 0,
          unlocks: { games: [], themes: [], fx: [] },
        }),
      );
    },
  });
  const w = dom.window;
  const errs = [];
  w.addEventListener("error", (e) => errs.push(String(e.message || e.error)));
  await wait(300);

  const d = w.document;
  check("shop page loads without errors", errs.length === 0);
  const coinNum = d.querySelector("#ecoBar .eco-coin-num b");
  check("balance bar shows coin balance", coinNum && coinNum.textContent === "120");
  const prog = d.querySelector("#ecoBar .eco-prog-head span");
  check("balance bar shows XP progress", prog && /until/.test(prog.textContent));
  check("balance bar shows time played", /time played/.test(d.querySelector("#ecoBar").textContent));

  const cards = d.querySelectorAll("#shopBody .shop-card");
  check("3 beta + 7 theme + 6 particle cards render", cards.length === 16);
  check("rows rendered for boosts + effects", d.querySelectorAll("#shopBody .shop-row").length === 3);
  check("locked items show a price chip", d.querySelectorAll("#shopBody .price-chip").length === 19);
  check("custom accent is a shop unlock", /Custom accent color/.test(d.querySelector("#shopBody").textContent));
  check("beta game names render", /Simon: Deluxe/.test(d.querySelector("#shopBody").textContent));

  /* theme packs are real themes: live preview, palette strip, corner badge */
  check("every theme card previews the real backdrop", d.querySelectorAll("#shopBody .pack-preview").length === 7);
  check("preview carries the pack id", !!d.querySelector('#shopBody .pack-preview[data-pack="cosmos"]'));
  check("locked packs keep a visible corner badge", d.querySelectorAll("#shopBody .pack-lock").length === 7);
  check("palette strips show all four colors (themes + particles)", d.querySelectorAll("#shopBody .pack-strip i").length === 52);
  check("packs list their features", /Starfield/.test(d.querySelector("#shopBody").textContent));

  /* background particles are a shop section of their own */
  check("particle cards preview the real layer", d.querySelectorAll("#shopBody .part-preview").length === 6);
  check("locked particles are veiled", d.querySelectorAll("#shopBody .part-lock").length === 6);
  check("particle names render", /Fireflies/.test(d.querySelector("#shopBody").textContent));

  /* buy the first beta game through the real modal flow */
  const btn = d.querySelector("#shopBody .shop-card .btn-primary");
  check("locked card has an Unlock button", btn && /Unlock/.test(btn.textContent));
  btn.click();
  await wait(400);
  const modal = d.querySelector(".modal-ov.open");
  check("clicking Unlock opens the confirm modal", !!modal);
  check("confirm modal names the item", modal && /Simon: Deluxe/.test(modal.textContent));
  const ok = modal && modal.querySelector(".btn-primary");
  check("confirm modal has a Buy button", ok && /Buy for 60/.test(ok.textContent));
  if (ok) ok.click();
  await wait(400);
  const st = w.N.econ.state();
  check("coins spent (120 → 60)", st.coins === 60);
  check("beta unlocked in storage", w.N.econ.isUnlocked("game", "beta-simon") === true);
  check("card re-rendered as owned", d.querySelectorAll("#shopBody .shop-card.owned").length === 1);
  check("price chips drop to 18", d.querySelectorAll("#shopBody .price-chip").length === 18);
  const owned = d.querySelector("#shopBody .shop-card.owned");
  check("owned card offers Play", !!owned && /Play/.test(owned.textContent));
  check("no window errors after buying", errs.length === 0);

  /* a bought theme applies a whole pack: palette, tint and a live backdrop */
  const pack = w.N.econ.buy("theme", "synthwave");
  check("theme pack purchasable", pack.ok === true);
  w.N.theme.setAccent("synthwave");
  const root = d.documentElement;
  check("pack flags html[data-pack]", root.dataset.pack === "synthwave");
  check("pack writes its palette vars", /#ff4fa8/.test(root.style.getPropertyValue("--pk-1")));
  check("pack writes its tint vars", !!root.style.getPropertyValue("--pk-bg-1"));
  const fx = d.querySelector("body > .pack-fx");
  check("pack renders the backdrop layer", !!fx && fx.dataset.pack === "synthwave");
  check("backdrop has three art layers", !!fx && fx.querySelectorAll("i.pf-a, i.pf-b, i.pf-c").length === 3);

  /* particle kinds — each pack's backdrop is built from its own parts list */
  const kindsFor = (id) => {
    w.N.econ.grant("theme", id);
    w.N.theme.setAccent(id);
    const el = d.querySelector("body > .pack-fx");
    return el ? Array.from(el.querySelectorAll(".pf-p")).map((h) => h.className.replace(/.*pf-p-/, "")) : [];
  };
  const aurora = kindsFor("aurora");
  check("aurora drifts ribbons + stars", aurora.indexOf("ribbon") >= 0 && aurora.indexOf("star") >= 0);
  const cosmos = kindsFor("cosmos");
  check("cosmos has a deep starfield", cosmos.indexOf("star") >= 0 && cosmos.indexOf("starfar") >= 0 && cosmos.indexOf("dust") >= 0);
  const vapor = kindsFor("vapor");
  check("vapor has smoke + clouds", vapor.indexOf("smoke") >= 0 && vapor.indexOf("cloud") >= 0);
  check("particles carry their randomness", !!d.querySelector('body > .pack-fx[data-pack="vapor"] .pf-p-smoke b'));
  const matrix = kindsFor("matrix");
  check("matrix still rains", matrix.indexOf("rain") >= 0);

  /* free packs work the same as bought ones */
  w.N.theme.setAccent("mist");
  const mist = d.querySelector('body > .pack-fx[data-pack="mist"]');
  check("free pack applies without buying", !!mist && root.dataset.pack === "mist");

  /* custom accent (Shop fx unlock) — any color, second tone derived */
  w.N.econ.grant("fx", "customaccent");
  check("custom accent reports unlocked", w.N.theme.customOn() === true);
  w.N.theme.setCustomAccent("#ff8800");
  check("custom accent drives --ac-1", root.style.getPropertyValue("--ac-1") === "#ff8800");
  check("custom accent derives a second tone", /^#[0-9a-f]{6}$/i.test(root.style.getPropertyValue("--ac-2")) && root.style.getPropertyValue("--ac-2") !== "#ff8800");
  check("custom accent clears any pack", !root.dataset.pack && !d.querySelector("body > .pack-fx"));

  w.N.theme.setAccent("ice");
  check("plain accent clears the pack", !root.dataset.pack && !d.querySelector("body > .pack-fx"));
  check("plain accent leaves no pack vars", root.style.getPropertyValue("--pk-1") === "");
}

/* ---------------------------------------------------------------- *
 * Part D — unread dot on the Announcements nav icon                 *
 * ---------------------------------------------------------------- */
async function partD() {
  const mk = (seed) =>
    new JSDOM(injectPage("games/index.html"), {
      url: "http://localhost:5173/games/",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = () => Promise.reject(new Error("no fetch"));
        window.scrollTo = () => {};
        window.matchMedia = () => ({ matches: false });
        window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
        window.cancelAnimationFrame = (id) => clearTimeout(id);
        window.HTMLElement.prototype.scrollIntoView = () => {};
        if (seed) Object.keys(seed).forEach((k) => window.localStorage.setItem(k, seed[k]));
      },
    });

  const a = mk(null);
  await wait(350);
  const link = a.window.document.querySelector('a[href="/announcements"]');
  check("nav has the announcements link", !!link);
  check("unread dot painted on the nav icon", !!(link && link.querySelector(".nav-dot")));
  a.window.N.ann.markSeen();
  await wait(80);
  check("dot removed once announcements are seen", !a.window.document.querySelector(".nav-dot"));
  a.window.close();

  const b = mk({ "null:annSeen": JSON.stringify("2026-09-01") });
  await wait(350);
  check("no dot for a returning (caught-up) user", !b.window.document.querySelector(".nav-dot"));
  b.window.close();
}

/* ---------------------------------------------------------------- *
 * Part E — home tip card + new-since-last-visit strip               *
 * ---------------------------------------------------------------- */
async function partE() {
  const dom = new JSDOM(injectPage("index.html"), {
    url: "http://localhost:5173/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("no fetch"));
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.localStorage.setItem("null:lastVisit", JSON.stringify(Date.parse("2026-09-01")));
    },
  });
  const w = dom.window;
  const errs = [];
  w.addEventListener("error", (e) => errs.push(String(e.message || e.error)));
  await wait(600);

  const d = w.document;
  const tipSec = d.querySelector("#tipSec");
  check("tip section is shown", tipSec && tipSec.hidden === false);
  const kicker = d.querySelector("#tipCard .tip-kicker");
  check("tip card has the kicker", kicker && kicker.textContent === "Tip of the day");
  check("tip card has text", (d.querySelector("#tipCard .tip-body p") || {}).textContent.length > 20);

  const sec = d.querySelector("#newSec");
  check("new-since strip is shown", sec && sec.hidden === false);
  const items = d.querySelectorAll("#newTrack .ns-item");
  const copies = parseInt(d.querySelector("#newTrack").style.getPropertyValue("--ns-copies"), 10) || 2;
  check("strip repeats the list enough to fill the screen", copies >= 2 && items.length === 5 * copies);
  check("strip repeats whole copies (seamless loop)", items.length % 5 === 0);
  check("strip names the new games", /Snake/.test(d.querySelector("#newTrack").textContent));
  check("strip has dot separators", d.querySelectorAll("#newTrack .ns-dot").length === items.length);
  check("strip duration + copy-count variables set", /--ns-dur/.test(d.querySelector("#newTrack").style.cssText || "") && /--ns-copies/.test(d.querySelector("#newTrack").style.cssText || ""));
  check("no window errors on home", errs.length === 0);
  w.close();

  /* brand-new visitor: no baseline yet → the last week of additions shows */
  const fresh = new JSDOM(injectPage("index.html"), {
    url: "http://localhost:5173/",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("no fetch"));
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
    },
  });
  await wait(600);
  check("first-time visitor still sees the new strip", fresh.window.document.querySelector("#newSec").hidden === false);
  check("first visit records a last-visit timestamp", !!fresh.window.localStorage.getItem("null:lastVisit"));
  fresh.window.close();
}

/* ---------------------------------------------------------------- *
 * Part F2 — install-as-an-app row in Settings                       *
 * ---------------------------------------------------------------- */
async function partG() {
  const dom = new JSDOM(injectPage("settings.html"), {
    url: "http://localhost:5173/settings",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("no fetch"));
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      /* jsdom has no object URLs; the export builds one for its download */
      window.URL.createObjectURL = () => "blob:null-backup";
      window.URL.revokeObjectURL = () => {};
    },
  });
  const w = dom.window;
  const errs = [];
  w.addEventListener("error", (e) => errs.push(String(e.message || e.error)));
  await wait(400);
  const d = w.document;
  check("settings page loads without errors", errs.length === 0);
  check("install module exposed", !!w.N.install && typeof w.N.install.prompt === "function");
  const hint = d.querySelector("#installHint");
  check("install row explains the browser hasn't offered it yet", hint && /Not offered/.test(hint.textContent));
  check("install button stays hidden without the prompt event", d.querySelector("#installBtn").hidden === true);

  /* settings now owns a Theme packs card, separate from plain accents */
  const packGrid = d.querySelector("#packGrid");
  check("settings has a Theme packs card", !!packGrid && /Theme packs/.test(d.querySelector("#packSection").textContent));
  check(
    "every pack is listed (free + shop)",
    d.querySelectorAll("#packGrid .pack-card").length === w.N.econ.FREE_PACKS.length + w.N.econ.THEMES.length,
  );
  check(
    "free packs usable, shop packs veiled",
    d.querySelectorAll("#packGrid .pack-card.owned").length === w.N.econ.FREE_PACKS.length &&
      d.querySelectorAll("#packGrid .pack-lock").length === w.N.econ.THEMES.length,
  );
  check(
    "settings previews real backdrops",
    d.querySelectorAll("#packGrid .pack-preview").length === w.N.econ.FREE_PACKS.length + w.N.econ.THEMES.length,
  );
  check("accent row keeps only plain accents", d.querySelectorAll("#accentRow .swatch-btn").length === w.N.theme.ACCENTS.length);
  check("custom accent row waits for the unlock", d.querySelector("#accentCustomRow").style.display === "none");

  /* settings owns the free particles too, with the shop's veiled */
  const partGrid = d.querySelector("#partGrid");
  check("settings has a Background particles card", !!partGrid);
  check("free particles are listed + usable", d.querySelectorAll("#partGrid .pack-card.owned").length === 3);
  check("shop particles are veiled in settings", d.querySelectorAll("#partGrid .part-lock").length === w.N.econ.PARTICLES.length);
  check("settings previews real particle layers", d.querySelectorAll("#partGrid .part-preview").length === 9);

  const applyBtn = d.querySelector("#packGrid .pack-card.owned .shop-foot .btn");
  check("free pack card offers Apply", applyBtn && /Apply/.test(applyBtn.textContent));
  applyBtn.click();
  check("applying from settings sets the pack", d.documentElement.dataset.pack === "dawn");
  check("applied card flips to Applied", /Applied/.test(d.querySelector("#packGrid .pack-card.playing").textContent));
  d.querySelector("#packGrid .pack-card.playing .shop-foot .btn").click();
  check("clicking Applied clears the pack", !d.documentElement.dataset.pack);
  check("no window errors after pack switches", errs.length === 0);
  d.querySelector("#installHelp").click();
  await wait(400);
  const modal = d.querySelector(".modal-ov.open");
  check("'How?' opens install instructions", modal && /Install NULL in Chrome/.test(modal.textContent));
  w.close();
}

/* ---------------------------------------------------------------- *
 * Part H — settings: list layout, see-through locks, data backup    *
 * ---------------------------------------------------------------- */
async function partH() {
  const dom = new JSDOM(injectPage("settings.html"), {
    url: "http://localhost:5173/settings",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("no fetch"));
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.URL.createObjectURL = () => "blob:null-backup";
      window.URL.revokeObjectURL = () => {};
      window.localStorage.setItem("null:favs", JSON.stringify([{ k: "game", id: "x" }]));
    },
  });
  const w = dom.window;
  const errs = [];
  w.addEventListener("error", (e) => errs.push(String(e.message || e.error)));
  await wait(400);
  const d = w.document;

  check("pack + particle grids use the full-width list layout",
    d.querySelector("#packGrid").classList.contains("shop-grid--list") &&
      d.querySelector("#partGrid").classList.contains("shop-grid--list"));

  const css = fs.readFileSync("src/styles/extra.css", "utf8");
  const lock = rule(css, ".pack-lock,\n.part-lock {");
  check("the lock is a corner badge, not a blur over the preview",
    /inset: auto/.test(lock) && !/inset: 0/.test(lock) && !/backdrop-filter/.test(lock));
  check("locked cards are no longer dimmed flat", !/\.pack-card\.locked \{\s*opacity/.test(css));
  check("list layout styles exist", /\.shop-grid--list \{/.test(css) && /\.shop-grid--list \.shop-card/.test(css));

  /* every particle kind got a bigger, louder shape */
  ["sparkle", "ember", "bubble", "plasma", "warp", "firefly"].forEach((k) => {
    check("particle redesigned: " + k, !!rule(css, ".pt-p-" + k + " b {"));
  });
  check("starlight is a real star shape", /clip-path: polygon\(50% 0%/.test(css));
  check("bubbles became flat rings", /border: calc\(var\(--s\) \* 0\.55\) solid/.test(css));
  check("warp streaks instead of dots", /@keyframes pt-warp/.test(css) && /scaleX\(/.test(rule(css, "@keyframes pt-warp")));
  check("plasma has its own drift keyframe", /@keyframes pt-plasma/.test(css));

  /* warp really leaves dead centre: the streaks are pinned to 50%/50%, the
     box is centred on that point and the pivot sits on its left edge */
  const warpStreak = rule(css, ".part-fx .pt-p-warp b,");
  check(
    "warp pivots on the exact centre",
    /margin-top: calc\(var\(--s\) \* -0\.7\)/.test(warpStreak) && /transform-origin: 0 50%/.test(warpStreak),
  );
  check("warp core glows from the middle", /closest-side at 50% 50%/.test(rule(css, ".part-fx .pt-p-warp::before,")));
  const tunnel = rule(css, ".pt-p-tunnel b {");
  check("tunnel rings are centred too", /margin: calc\(var\(--s\) \* -22\) 0 0 calc\(var\(--s\) \* -22\)/.test(tunnel));

  /* the layered kinds the shop particles are now built from */
  ["bloom", "trail", "wisp", "flare", "glint", "swirl", "speck"].forEach((k) => {
    check("layered kind styled: " + k, !!rule(css, ".pt-p-" + k + " b {"));
    check("layered kind animates: " + k, /@keyframes pt-/.test(css) && css.indexOf("@keyframes pt-" + k) > 0);
  });
  check("particles carry depth", /--z/.test(css) && /calc\(\(1\.4 - var\(--z/.test(css));

  /* period bells: one timer aimed at the next boundary, so confetti lands on
     the bell instead of up to 30s after it, and both bells count */
  const shellSrc = fs.readFileSync("src/components/shell.js", "utf8");
  check("period bells are scheduled, not polled", !/setInterval\(check/.test(shellSrc));
  check("a timer is aimed at the next bell", /function armBell\(/.test(shellSrc) && /lv\.secLeft \* 1000/.test(shellSrc));
  check("the bell key changes on both boundaries", /function blockKey\(/.test(shellSrc) && /lv\.passing \? "p" : ""/.test(shellSrc));
  check("any key change that isn't end-of-day rings", /key !== "end" && key !== lastKey/.test(shellSrc));
  check("a hidden tab never celebrates a bell it slept through", /visibilitychange/.test(shellSrc));

  /* light mode: packs get a daylight tint, particles get re-inked */
  const lightPacks = rule(css, 'html[data-theme="light"] .pack-fx,\nhtml[data-theme="light"] .pack-preview {', 0);
  check("light mode rewrites the pack page tint", /--pk-bg-1: #f/.test(lightPacks) && /!important/.test(lightPacks));
  check("light mode keeps the pack art (no blanket opacity fade)", !/html\[data-theme="light"\] \.pack-fx \{\s*opacity: 0\.4/.test(css));
  check(
    "light mode darkens pale pack particles (white stars/dust would vanish)",
    /html\[data-theme="light"\] \.pack-fx \.pf-p,\nhtml\[data-theme="light"\] \.pack-preview \.pf-p \{\n  filter:/.test(css),
  );
  check(
    "light mode deepens synthwave's sun + grid",
    /html\[data-theme="light"\] \[data-pack="synthwave"\] \.pf-c \{/.test(css) &&
      /html\[data-theme="light"\] \[data-pack="synthwave"\] \.pf-b \{/.test(css),
  );
  check("light mode re-inks the particle layers", /html\[data-theme="light"\] \.part-fx,\nhtml\[data-theme="light"\] \.part-preview \{\n  filter:/.test(css));

  /* tip card is rounded like the rest of NULL */
  check("tip card is rounded like every other surface", /border-radius: var\(--r-lg\)/.test(rule(css, ".tip-card {")));

  /* export / import */
  check("settings offers a data download", !!d.querySelector("#btnDataExport"));
  check("settings offers a data upload", !!d.querySelector("#btnDataImport") && !!d.querySelector("#dataFile"));
  check(
    "the backup row explains same-address windows sync on their own",
    /stays in sync with the others/.test(d.querySelector('[aria-label="Your data"]').textContent),
  );

  /* live sync: another window sharing this origin writes, the browser fires
     `storage` here, and this window adopts the new settings without a reload */
  check("the sync bus is exposed", !!w.N.sync && typeof w.N.sync.register === "function");
  w.localStorage.setItem("null:prefs", JSON.stringify({ theme: "light", accent: "gold", glow: "off" }));
  w.dispatchEvent(new w.StorageEvent("storage", { key: "null:prefs" }));
  await wait(120);
  check("another window's write is adopted live", d.documentElement.dataset.theme === "light");
  check("live sync re-reads prefs into memory", w.N.prefs.get("theme") === "light");
  check("live sync repaints the settings controls", d.querySelector('#themeSeg button[data-val="light"]').classList.contains("on"));
  /* another site on the same origin writing its own keys must not disturb us */
  w.localStorage.setItem("other-app:prefs", JSON.stringify({ theme: "dark" }));
  w.dispatchEvent(new w.StorageEvent("storage", { key: "other-app:prefs" }));
  await wait(80);
  check("unrelated storage keys are ignored", w.N.prefs.get("theme") === "light");

  d.querySelector("#btnDataExport").click();
  await wait(60);
  check("export runs without errors", errs.length === 0);

  const backup = JSON.stringify({ app: "null", v: 1, data: { "null:prefs": JSON.stringify({ theme: "light" }), "null:eco": JSON.stringify({ coins: 999 }) } });
  const file = new w.File([backup], "null-data.json", { type: "application/json" });
  const picker = d.querySelector("#dataFile");
  Object.defineProperty(picker, "files", { value: [file], configurable: true });
  picker.dispatchEvent(new w.Event("change"));
  await wait(200);
  const confirm = Array.from(d.querySelectorAll(".modal-ov.open .btn")).find((b) => /Load it/.test(b.textContent));
  check("loading a backup asks for confirmation first", !!confirm);
  if (confirm) confirm.click();
  await wait(120);
  check("backup replaced the stored profile", JSON.parse(w.localStorage.getItem("null:eco")).coins === 999);
  check("stale keys not in the backup are dropped", w.localStorage.getItem("null:favs") === null);

  /* a junk file is rejected instead of wiping anything */
  const junk = new w.File(["not json at all"], "x.json", { type: "application/json" });
  Object.defineProperty(picker, "files", { value: [junk], configurable: true });
  picker.dispatchEvent(new w.Event("change"));
  await wait(200);
  const openText = Array.from(d.querySelectorAll(".modal-ov.open")).map((m) => m.textContent).join(" ");
  check("junk backups are refused without wiping the profile",
    !/Load \d+ saved/.test(openText) && JSON.parse(w.localStorage.getItem("null:eco")).coins === 999);
  w.close();
}

/* ---------------------------------------------------------------- *
 * Part F — player boot spinner + coin readout markup                *
 * ---------------------------------------------------------------- */
function partF() {
  const html = fs.readFileSync("player.html", "utf8");
  const files = fs.readdirSync("src/pages").map((f) => "src/pages/" + f);
  check("player has the branded spinner markup", /class="pl-mark"/.test(html) && /class="pl-ring"/.test(html) && /class="pl-core"/.test(html));
  check("player spinner keeps the ban mark", /data-icon="ban"/.test(html));
  check("player bar shows a coin counter", /id="pCoinVal"/.test(html));
  check("player page loads econ.js", /econ\.js/.test(html));
  const extra = fs.readFileSync("src/styles/extra.css", "utf8");
  check("spinner styles exist", /\.pl-ring \{/.test(extra) && /@keyframes plSpin/.test(extra));
  check("shop styles exist", /\.shop-grid \{/.test(extra) && /\.eco-track i \{/.test(extra));
  check("nav dot styles exist", /\.nav-dot \{/.test(extra) && /@keyframes dotPulse/.test(extra));
  check("tip + strip styles exist", /\.tip-card \{/.test(extra) && /@keyframes nsScroll/.test(extra));
  check("strip loop divides by the copy count", /100% \/ var\(--ns-copies/.test(extra));
  /* every pack id must have backdrop art, or the layer renders empty */
  ["synthwave", "matrix", "gold", "aurora", "cosmos", "vapor", "neon", "dawn", "mist"].forEach((id) => {
    check("pack art exists: " + id, extra.indexOf('[data-pack="' + id + '"]') >= 0);
  });
  check("graphite art is fully removed", extra.indexOf('[data-pack="graphite"]') < 0);
  ["rain", "star", "starfar", "dust", "ribbon", "smoke", "cloud", "neontube", "neonpulse"].forEach((k) => {
    check("particle kind styled: " + k, extra.indexOf(".pf-p-" + k + " b") >= 0);
  });
  /* the neon room is painted from --glow-*, so theme.js has to publish them */
  check(
    "neon glow layers use the border palette",
    /\[data-pack="neon"\] \.pf-a \{[\s\S]*?--glow-1/.test(extra) && extra.indexOf("pk-neon-floor") > 0 && extra.indexOf("pk-neon-orbit") > 0,
  );
  check("particle keyframes exist", /@keyframes pk-smoke/.test(extra) && /@keyframes pk-ribbon/.test(extra) && /@keyframes pk-starDrift/.test(extra));
  check("pack layer base styles exist", /\.pack-fx \{/.test(extra) && /\.pack-fx\.pf-paused/.test(extra));
  check("pack preview + swatch styles exist", /\.pack-thumb \{/.test(extra) && /\.accent-dots i \{/.test(extra));
  files.forEach(() => {});
  const shop = fs.readFileSync("shop.html", "utf8");
  check("manifest linked on shop page", /manifest\.webmanifest/.test(shop));
  check("sw.js exists at the root", fs.existsSync("sw.js"));
  const man = JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));
  check("manifest has 192 + 512 icons", man.icons.some((i) => i.sizes === "192x192") && man.icons.some((i) => i.sizes === "512x512"));
  check("manifest starts at the site root", man.start_url === "/");
  check("icon files generated", fs.existsSync("public/icon-192.png") && fs.existsSync("public/icon-512.png") && fs.existsSync("public/icon-maskable-512.png"));
}

/* ---------------------------------------------------------------- *
 * Part I — Neon follows the glow-border palette                     *
 * ---------------------------------------------------------------- */
async function partI() {
  const dom = new JSDOM(injectPage("settings.html"), {
    url: "http://localhost:5173/settings",
    runScripts: "dangerously",
    pretendToBeVisual: true,
    beforeParse(window) {
      window.fetch = () => Promise.reject(new Error("no fetch"));
      window.scrollTo = () => {};
      window.matchMedia = () => ({ matches: false });
      window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
      window.cancelAnimationFrame = (id) => clearTimeout(id);
      window.HTMLElement.prototype.scrollIntoView = () => {};
      window.URL.createObjectURL = () => "blob:null-backup";
      window.URL.revokeObjectURL = () => {};
    },
  });
  const w = dom.window;
  const errs = [];
  w.addEventListener("error", (e) => errs.push(String(e.message || e.error)));
  await wait(400);
  const root = w.document.documentElement;

  /* with the border off, Neon's own tubes are published as the fallback */
  const fallback = root.style.getPropertyValue("--glow-1");
  check("the glow palette is always published", !!fallback && !!root.style.getPropertyValue("--glow-4"));
  check("no border lit means no glowOn marker", !root.dataset.glowOn);

  /* buy Neon, apply it, then flip the border preset */
  w.N.econ.grant("theme", "neon");
  w.N.theme.setAccent("neon");
  w.N.prefs.set("accent", "neon");
  check("neon applies its own backdrop", root.dataset.pack === "neon");
  check("neon's accent starts on its own tubes", root.style.getPropertyValue("--ac-1") === fallback);

  w.N.theme.setGlow("rainbow");
  await wait(60);
  const first = root.style.getPropertyValue("--glow-1");
  check("a border preset republishes the palette", first === "#ff4d6d");
  check("the border is marked as lit", root.dataset.glowOn === "1");
  check("neon's accent re-inks with the border", root.style.getPropertyValue("--ac-1") === first);
  check("neon's backdrop rebuilt on the new palette", root.dataset.pack === "neon" && !!w.document.querySelector('[data-pack="neon"]'));

  /* a custom border colour reaches the pack too */
  w.N.prefs.set("glowColor1", "#00ff88");
  w.N.theme.setGlow("custom");
  await wait(60);
  check("custom glow colours reach the pack", root.style.getPropertyValue("--glow-1") === "#00ff88");

  w.N.theme.setAccent("off");
  await wait(60);
  check("leaving neon keeps the palette published", !!root.style.getPropertyValue("--glow-1"));
  check("no window errors during the glow swaps", errs.length === 0);
  w.close();
}

(async function main() {
  partA();
  await partC();
  await partD();
  await partE();
  await partG();
  await partH();
  await partI();
  partF();
  console.log(failures ? "FAILURES: " + failures : "ALL SHOP CHECKS PASS");
  process.exit(failures ? 1 : 0);
})();
