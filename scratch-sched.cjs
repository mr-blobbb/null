const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const root = process.env.PROJ || "/";
const page = "schedule.html";

const html = fs.readFileSync(path.join(root, page), "utf8");
const stripped = html.replace(/<script\b[^>]*src=[^>]*><\/script>/g, "");

const dom = new JSDOM(stripped, {
  url: "http://localhost:5173/schedule.html",
  runScripts: "dangerously",
  pretendToBeVisual: true,
});
const win = dom.window;
win.requestAnimationFrame = (fn) => setTimeout(fn, 0);
win.scrollTo = () => {};
if (!win.ResizeObserver) {
  win.ResizeObserver = class { constructor(){} observe(){} disconnect(){} };
}
const doc = win.document;

const order = [
  "src/utilities/store.js",
  "src/utilities/dom.js",
  "src/utilities/modal.js",
  "src/utilities/theme.js",
  "src/utilities/scroll.js",
  "src/routing/router.js",
  "src/catalog/generated-catalog.js",
  "src/catalog/catalog.js",
  "src/content/content.js",
  "src/components/tabpresets.js",
  "src/components/schedule.js",
  "src/components/cards.js",
  "src/components/search.js",
  "src/components/shell.js",
  "src/pages/schedule.js",
];
let err = null;
try {
  for (const f of order) fs.readFileSync(path.join(root, f), "utf8");
  for (const f of order) win.eval(fs.readFileSync(path.join(root, f), "utf8"));
  doc.dispatchEvent(new win.Event("DOMContentLoaded"));
} catch (e) { err = e; }

function dump(label) {
  const grid = doc.getElementById("schedGridBox");
  const rows = grid ? grid.querySelectorAll(".sched-row") : [];
  const live = doc.getElementById("liveBox");
  const lsName = live ? live.querySelector(".ls-name") : null;
  const lsTime = live ? live.querySelector(".ls-time") : null;
  const lsLeft = live ? live.querySelector(".ls-left") : null;
  const lsNext = live ? live.querySelector(".ls-next b") : null;
  console.log("== " + label + " ==");
  console.log("  grid rows:", rows.length, "names:", Array.from(rows).map(r => (r.querySelector(".s-name")||{}).textContent).join(","));
  console.log("  live name:", lsName ? lsName.textContent : "none", "| time:", lsTime ? lsTime.textContent : "none", "| left:", lsLeft ? lsLeft.textContent : "none", "| next:", lsNext ? lsNext.textContent : "none");
}

setTimeout(() => {
  if (err) { console.log("err:", err.stack || err); process.exit(0); }
  dump("initial (chosen = today)");

  // simulate clicking a different day chip (e.g. Monday = first chip) then back to Friday
  const chips = doc.getElementById("schedChips").querySelectorAll(".chip-btn");
  const names = Array.from(chips).map(c => c.textContent);
  console.log("chips:", JSON.stringify(names));
  if (chips.length >= 2) {
    chips[0].click(); // Monday
    setTimeout(() => {
      dump("after clicking Monday");
      const friday = Array.from(chips).find(c => c.textContent.indexOf("Fri") === 0);
      if (friday) friday.click();
      setTimeout(() => { dump("after clicking back to Friday"); process.exit(0); }, 20);
    }, 20);
  } else process.exit(0);
}, 150);