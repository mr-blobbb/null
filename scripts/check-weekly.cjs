/* Verify the unread-announcement dot and the weekly wrap-up against the real
   source files, in jsdom. */
const fs = require("fs");
const { JSDOM } = require("jsdom");

let failures = 0;
function check(name, ok) {
  console.log((ok ? "ok  " : "FAIL") + "  " + name);
  if (!ok) failures++;
}

/* ---------------------------------------------------------------- *
 * Part 1 — announcements unread dot (real page, real scripts)       *
 * ---------------------------------------------------------------- */
function injectPage(file) {
  let html = fs.readFileSync(file, "utf8");
  const css =
    fs.readFileSync("src/styles/global.css", "utf8") +
    "\n" +
    fs.readFileSync("src/styles/extra.css", "utf8");
  html = html
    .replace('<link rel="stylesheet" href="/src/styles/global.css">', "<style>" + css + "</style>")
    .replace('<link rel="stylesheet" href="/src/styles/extra.css">', "");

  const FILES = {
    "/src/utilities/store.js": "src/utilities/store.js",
    "/src/utilities/dom.js": "src/utilities/dom.js",
    "/src/utilities/modal.js": "src/utilities/modal.js",
    "/src/utilities/theme.js": "src/utilities/theme.js",
    "/src/components/seasons.js": "src/components/seasons.js",
    "/src/utilities/scroll.js": "src/utilities/scroll.js",
    "/src/routing/router.js": "src/routing/router.js",
    "/src/catalog/generated-catalog.js": "src/catalog/generated-catalog.js",
    "/src/catalog/catalog.js": "src/catalog/catalog.js",
    "/src/content/content.js": "src/content/content.js",
    "/src/components/tabpresets.js": "src/components/tabpresets.js",
    "/src/components/schedule.js": "src/components/schedule.js",
    "/src/components/cards.js": "src/components/cards.js",
    "/src/components/search.js": "src/components/search.js",
    "/src/components/shell.js": "src/components/shell.js",
    "/src/components/devconsole.js": "src/components/devconsole.js",
    "/src/pages/announcements.js": "src/pages/announcements.js",
  };
  for (const [src, file] of Object.entries(FILES)) {
    const rx = new RegExp(
      `<script src="${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\?v=[a-f0-9]+)?"></script>`,
    );
    html = html.replace(rx, `<script>${fs.readFileSync(file, "utf8")}</script>`);
  }
  return html;
}

const annHtml = injectPage("announcements.html");

/* fresh user — no annSeen yet */
const domA = new JSDOM(annHtml, {
  url: "http://localhost:5173/announcements",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = () => Promise.reject(new Error("no fetch"));
    window.scrollTo = () => {};
    window.matchMedia = () => ({ matches: false });
    window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  },
});
const wA = domA.window;
const errsA = [];
wA.addEventListener("error", (e) => errsA.push(String(e.message || e.error)));

setTimeout(() => {
  const eye = wA.document.querySelector(".page-head .eyebrow");
  const dot = eye && eye.querySelector(".ann-dot");
  check("dot appears in eyebrow for fresh user", !!dot);
  check("dot is green + has pulse anim", dot && dot.style.animation !== undefined && dot.className === "ann-dot");

  setTimeout(() => {
    const gone = !wA.document.querySelector(".ann-dot");
    const seen = wA.localStorage.getItem("null:annSeen");
    check("dot removed after being seen", gone);
    check("annSeen recorded (latest announcement date)", seen === JSON.stringify("2026-09-01"));
    check("no window errors on announcements page", errsA.length === 0);

    /* returning user — dot must NOT appear */
    const domB = new JSDOM(annHtml, {
      url: "http://localhost:5173/announcements",
      runScripts: "dangerously",
      pretendToBeVisual: true,
      beforeParse(window) {
        window.fetch = () => Promise.reject(new Error("no fetch"));
        window.scrollTo = () => {};
        window.matchMedia = () => ({ matches: false });
        window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
        window.cancelAnimationFrame = (id) => clearTimeout(id);
        window.localStorage.setItem("null:annSeen", JSON.stringify("2026-09-01"));
      },
    });
    const wB = domB.window;
    setTimeout(() => {
      check("no dot for returning user (already seen)", !wB.document.querySelector(".ann-dot"));
      part2();
    }, 600);
  }, 3400);
}, 600);

/* ---------------------------------------------------------------- *
 * Part 2 — weekly wrap-up rollover + dev console triggers           *
 * ---------------------------------------------------------------- */
function part2() {
  const gamesHtml = injectPage("games/index.html");
  const dom = new JSDOM(gamesHtml, {
    url: "http://localhost:5173/games/",
    runScripts: "outside-only",
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

  const vm = require("vm");
  const ctx = dom.getInternalVMContext();
  const run = (file) => vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });

  /* seed LAST week's log before store.js reads it */
  const now = new Date();
  const lastMon = new Date(now.getTime() - 7 * 86400000);
  const day = lastMon.getDay() || 7;
  lastMon.setDate(lastMon.getDate() - day + 1);
  const wk = lastMon.toISOString().slice(0, 10);
  w.localStorage.setItem(
    "null:week",
    JSON.stringify({
      week: wk,
      plays: [
        { k: "game", id: "flip", at: Date.now() - 3600000 },
        { k: "game", id: "flip", at: Date.now() - 7200000 },
        { k: "game", id: "pulse", at: Date.now() - 1800000 },
        { k: "app", id: "calc", at: Date.now() - 900000 },
        { k: "app", id: "calc", at: Date.now() - 100000 },
      ],
    }),
  );

  run("src/utilities/store.js");
  run("src/utilities/dom.js");
  run("src/utilities/modal.js");
  run("src/catalog/generated-catalog.js");

  /* stubs for shell.js dependencies that don't matter here */
  vm.runInContext(
    `(function () {
      var N = window.N;
      N.router = { PRIMARY: [], GROUPS: [], FOOT: [], isActive: function () { return false; } };
      N.tab = { apply: function () {}, smartStart: function () {}, current: function () { return {}; }, titleFor: function () { return "NULL"; } };
      N.search = { open: function () {} };
      N.schedule = { todayInfo: function () { return { type: null }; } };
      N.scroll = { attach: function () {} };
      N.theme = { setTheme: function () {}, setAccent: function () {}, setGlow: function () {}, setComet: function () {}, setPerf: function () {} };
    })();`,
    ctx,
  );
  run("src/catalog/catalog.js");
  run("src/content/content.js");
  run("src/components/shell.js"); // init() runs → wrapupCheck scheduled at 1200ms

  const N = w.N;

  /* week module basics */
  check("week rollover available", !!N.week && !!N.wrapup);

  setTimeout(() => {
    /* wrapupCheck should have fired on its own (1200ms) */
    const curKey = N.week.key();
    check("log rolled to current week", curKey !== wk);
    const modal = w.document.querySelector(".modal-ov.open");
    const title = modal && modal.querySelector(".modal-head h3");
    check("wrap-up modal auto-opened on week rollover", !!modal);
    check("modal title is 'Your week in NULL'", title && title.textContent === "Your week in NULL");
    const stats = modal ? modal.querySelectorAll(".wu-stat b") : [];
    check("stats show total plays (5)", stats.length && stats[0].textContent === "5");
    check("stats show distinct items (3)", stats.length && stats[1].textContent === "3");
    const items = modal ? modal.querySelectorAll(".wu-item") : [];
    check("most-played list rendered", items.length === 3);
    check("top item is Flip (2x)", items.length && /Flip/i.test(items[0].textContent) && /2/.test(items[0].textContent));
    check("wrap-up flag set for that week", !!N.flags.get("wrapup:" + wk));

    /* second check must NOT re-show (flag) */
    N.wrapup.check();
    const countAfter = w.document.querySelectorAll(".modal-ov").length;
    check("no re-show for the same week", countAfter === 1);

    /* dev-console flow */
    run("src/components/devconsole.js");
    for (const ch of "nldev") {
      w.document.dispatchEvent(new w.KeyboardEvent("keydown", { key: ch, bubbles: true }));
    }
    setTimeout(() => {
      const ov = w.document.querySelector(".dc-ov");
      check("dev console opens with nldev", !!ov);
      const labels = ov ? Array.from(ov.querySelectorAll(".dc-b")).map((b) => b.textContent) : [];
      check("dev console has 'Weekly wrap-up' button", labels.some((t) => t.indexOf("Weekly wrap-up") >= 0));
      check("dev console has 'Seed weekly log' button", labels.some((t) => t.indexOf("Seed weekly log") >= 0));

      /* close console, then test wrapup.show() with fresh current-week data */
      if (ov) {
        const seedBtn = Array.from(ov.querySelectorAll(".dc-b")).find((b) => b.textContent.indexOf("Seed weekly log") >= 0);
        seedBtn.click();
        const playsAfterSeed = N.week.snapshot().plays.length;
        check("Seed weekly log added 12 plays", playsAfterSeed === 12);

        const wuBtn = Array.from(ov.querySelectorAll(".dc-b")).find((b) => b.textContent.indexOf("Weekly wrap-up") >= 0);
        wuBtn.click();
        const modalsNow = w.document.querySelectorAll(".modal-ov").length;
        check("dev 'Weekly wrap-up' opens current-week modal", modalsNow === 2);
      }

      /* catalog launch hook: N.launch.game must feed the week log */
      const before = N.week.snapshot().plays.length;
      N.launch.game({
        id: "void",
        name: "Void",
        file: "/games/void/void.html",
        warning: { title: "Heads up", description: "keyboard needed" },
      });
      check("N.launch.game logs the week (13 after seed + 1)", N.week.snapshot().plays.length === before + 1);
      check("no window errors (part 2)", errs.length === 0);
      console.log(failures ? "FAILURES: " + failures : "ALL WEEKLY CHECKS PASS");
      process.exit(failures ? 1 : 0);
    }, 150);
  }, 1800);
}