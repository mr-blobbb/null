/* Diagnostic: run games.html in jsdom (real CSS, real scripts) and report
   the computed style of every .tname — proves whether any CSS hides names. */
const fs = require("fs");
const { JSDOM } = require("jsdom");

let html = fs.readFileSync("games.html", "utf8");
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
  "/src/pages/library.js": "src/pages/library.js",
};
for (const [src, file] of Object.entries(FILES)) {
  const rx = new RegExp(`<script src="${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\?v=[a-f0-9]+)?"></script>`);
  html = html.replace(rx, `<script>${fs.readFileSync(file, "utf8")}</script>`);
}

const dom = new JSDOM(html, {
  url: "http://localhost:5173/games",
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.fetch = () => Promise.reject(new Error("no fetch"));
    window.scrollTo = () => {};
    window.matchMedia = () => ({ matches: false });
    window.requestAnimationFrame = (fn) => setTimeout(fn, 0);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
    // jsdom lacks these; stub minimal versions used by the code
    window.HTMLElement.prototype.scrollIntoView = () => {};
  },
});

const w = dom.window;
setTimeout(() => {
  try {
    const names = w.document.querySelectorAll(".tname");
    console.log(".tname count:", names.length);
    names.forEach((n, i) => {
      const cs = w.getComputedStyle(n);
      console.log(
        i + ": text=" + JSON.stringify(n.textContent) +
        " display=" + cs.display + " visibility=" + cs.visibility +
        " opacity=" + cs.opacity + " color=" + cs.color +
        " fontSize=" + cs.fontSize + " fontFamily=" + cs.fontFamily.slice(0, 40),
      );
    });
    const cards = w.document.querySelectorAll(".tcard");
    console.log(".tcard count:", cards.length);
    const errs = [];
    w.addEventListener("error", (e) => errs.push(String(e.message || e.error)));
    console.log("window errors:", errs.length ? errs : "none");
  } catch (e) {
    console.log("inspection failed:", e.message);
  }
  process.exit(0);
}, 600);