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
  check("3 free packs exist", N.econ.FREE_PACKS.length === 3);
  check("free packs start unlocked", ["graphite", "dawn", "mist"].every((id) => N.econ.isUnlocked("theme", id) === true));
  check("free packs are not purchasable", N.econ.buy("theme", "graphite").reason === "free");

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
  check("3 beta games + 6 theme packs render", cards.length === 9);
  check("rows rendered for boosts + effects", d.querySelectorAll("#shopBody .shop-row").length === 3);
  check("locked items show a price chip", d.querySelectorAll("#shopBody .price-chip").length === 12);
  check("custom accent is a shop unlock", /Custom accent color/.test(d.querySelector("#shopBody").textContent));
  check("beta game names render", /Simon: Deluxe/.test(d.querySelector("#shopBody").textContent));

  /* theme packs are real themes: live preview, palette strip, locked veil */
  check("every theme card previews the real backdrop", d.querySelectorAll("#shopBody .pack-preview").length === 6);
  check("preview carries the pack id", !!d.querySelector('#shopBody .pack-preview[data-pack="cosmos"]'));
  check("locked packs are veiled", d.querySelectorAll("#shopBody .pack-lock").length === 6);
  check("palette strip shows all four colors", d.querySelectorAll("#shopBody .pack-strip i").length === 24);
  check("packs list their features", /Starfield/.test(d.querySelector("#shopBody").textContent));

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
  check("price chips drop to 11", d.querySelectorAll("#shopBody .price-chip").length === 11);
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
  check("strip lists the 5 new items twice (seamless loop)", items.length === 10);
  check("strip names the new games", /Snake/.test(d.querySelector("#newTrack").textContent));
  check("strip has dot separators", d.querySelectorAll("#newTrack .ns-dot").length === 10);
  check("strip duration variable set", /--ns-dur/.test(d.querySelector("#newTrack").getAttribute("style") || "") || /--ns-dur/.test(d.querySelector("#newTrack").style.cssText || ""));
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
  check("every pack is listed (free + shop)", d.querySelectorAll("#packGrid .pack-card").length === 9);
  check("free packs usable, shop packs veiled", d.querySelectorAll("#packGrid .pack-card.owned").length === 3 && d.querySelectorAll("#packGrid .pack-lock").length === 6);
  check("settings previews real backdrops", d.querySelectorAll("#packGrid .pack-preview").length === 9);
  check("accent row keeps only plain accents", d.querySelectorAll("#accentRow .swatch-btn").length === w.N.theme.ACCENTS.length);
  check("custom accent row waits for the unlock", d.querySelector("#accentCustomRow").style.display === "none");

  const applyBtn = d.querySelector("#packGrid .pack-card.owned .shop-foot .btn");
  check("free pack card offers Apply", applyBtn && /Apply/.test(applyBtn.textContent));
  applyBtn.click();
  check("applying from settings sets the pack", d.documentElement.dataset.pack === "graphite");
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
  /* every pack id must have backdrop art, or the layer renders empty */
  ["synthwave", "matrix", "gold", "aurora", "cosmos", "vapor", "graphite", "dawn", "mist"].forEach((id) => {
    check("pack art exists: " + id, extra.indexOf('[data-pack="' + id + '"]') >= 0);
  });
  ["rain", "star", "starfar", "dust", "ribbon", "smoke", "cloud"].forEach((k) => {
    check("particle kind styled: " + k, extra.indexOf(".pf-p-" + k + " b") >= 0);
  });
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

(async function main() {
  partA();
  await partC();
  await partD();
  await partE();
  await partG();
  partF();
  console.log(failures ? "FAILURES: " + failures : "ALL SHOP CHECKS PASS");
  process.exit(failures ? 1 : 0);
})();
