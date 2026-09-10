/* Diagnostic: load games/index.html in jsdom with all real scripts, type
   "nldev" via dispatched keydown events, and report whether the dev console
   overlay appears (and any window errors). */
const fs = require("fs");
const { JSDOM } = require("jsdom");

let html = fs.readFileSync("games/index.html", "utf8");
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

const errs = [];
const dom = new JSDOM(html, {
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
  },
});

const w = dom.window;
w.addEventListener("error", (e) => errs.push(String(e.message || e.error)));

setTimeout(() => {
  try {
    const dev = w.N && w.N.dev;
    console.log("N.dev exists:", !!dev);

    // type nldev
    for (const ch of "nldev") {
      w.document.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: ch, bubbles: true }),
      );
    }

    setTimeout(() => {
      const ov = w.document.querySelector(".dc-ov");
      console.log("console overlay after typing nldev:", ov ? "OPENED" : "NOT OPENED");
      if (ov) {
        const box = ov.querySelector(".dc-box");
        console.log("has .dc-box:", !!box, "| buttons:", ov.querySelectorAll(".dc-b").length);
      }
      console.log("window errors:", errs.length ? errs : "none");
      process.exit(0);
    }, 100);
  } catch (e) {
    console.log("test failed:", e.message);
    process.exit(1);
  }
}, 500);