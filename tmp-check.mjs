import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync } from "node:fs";

function build(page, seed) {
  let html = readFileSync(page, "utf8");
  html = html.replace(/<script src="([^"]+)"[^>]*><\/script>/g, (whole, src) => {
    const clean = src.split("?")[0];
    if (/^https?:/.test(clean)) return "";
    try {
      return "<script>\n" + readFileSync(clean, "utf8") + "\n</" + "script>";
    } catch (e) {
      return "";
    }
  });
  html = html.replace(/<link[^>]+stylesheet[^>]*>/g, "");
  if (seed) html = html.replace(/<body([^>]*)>/, "<body$1><script>" + seed + "</" + "script>");
  return html;
}

/* count the 1s tickers a page arms, so "the clock updates every second" is
   something we can actually assert */
const SEED_COUNT = "var __f=window.setInterval,__n=0;window.setInterval=function(f,m){if(m===1000)__n++;return __f.apply(window,arguments);};window.__ticks=function(){return __n;};";

const errors = [];
async function open(page, seed, wait) {
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => {
    if (!/not implemented|Could not parse CSS|scrollIntoView/.test(String(e.message))) errors.push(page + ": " + e.message);
  });
  const dom = new JSDOM(build(page, seed), {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    url: "https://example.com/" + page.replace(/\.html$/, ""),
  });
  await new Promise((r) => setTimeout(r, wait == null ? 800 : wait));
  return dom;
}

const OLD = {
  id: "period-clock",
  kind: "native",
  name: "Period clock",
  version: "1.0.0",
  author: "you",
  desc: "old copy",
  icon: "clock",
  run: "always",
  css: "",
  js: "setInterval(function(){}, 15000);",
  html: "",
  pages: [],
  nav: [],
  manifest: { nullExt: 1, name: "Period clock", version: "1.0.0", author: "you" },
  enabled: true,
  at: Date.now(),
};

/* ---------- 1. a stale starter copy upgrade on sight ---------- */
const ext = await open(
  "extensions.html",
  "localStorage.setItem('null:ext', " + JSON.stringify(JSON.stringify([OLD])) + ");" +
    "localStorage.setItem('null:extdata:period-clock', JSON.stringify({greeted:1}));",
  1400,
);
const w = ext.window;
const doc = w.document;
const cards = [...doc.querySelectorAll("#extStart .start-card")].map((c) => c.querySelector("b").textContent + " · " + c.querySelector(".sc-meta").textContent.trim());
console.log("1. starter cards:", cards.join(" | "));
const reg = JSON.parse(w.localStorage.getItem("null:ext") || "[]");
console.log("   after boot:", reg.map((e) => e.name + " v" + e.version + " starter=" + !!e.starter).join(", "));
console.log("   toasts:", [...doc.querySelectorAll(".toast")].map((t) => t.textContent.trim()));
console.log("   nav chip:", !!doc.querySelector('[data-slot="nav"] .pc-chip'), "| tickers armed:", w.__ticks ? w.__ticks() : "n/a");
ext.window.close();

/* ---------- 2. the player ---------- */
const pl = await open(
  "player.html",
  SEED_COUNT + "localStorage.setItem('null:ext', " + JSON.stringify(JSON.stringify(reg)) + ");",
  1200,
);
const pdoc = pl.window.document;
const chip = pdoc.querySelector(".player-widgets .pc-chip");
console.log("2. player chip:", !!chip, JSON.stringify(chip && chip.textContent.trim()), "| 1s tickers:", pl.window.__ticks());
console.log("   player toasts:", [...pdoc.querySelectorAll(".toast")].map((t) => t.textContent.trim()));
pl.window.close();

/* ---------- 3. install from the page, then check the nav chip on home ---------- */
const ext2 = await open("extensions.html", null, 900);
const d2 = ext2.window.document;
const pc = [...d2.querySelectorAll("#extStart .start-card")].find((c) => c.querySelector("b").textContent === "Period clock");
pc.querySelector(".sc-acts .btn").click();
await new Promise((r) => setTimeout(r, 250));
const ok = [...d2.querySelectorAll(".modal button")].filter((b) => /install/i.test(b.textContent))[0];
if (ok) ok.click();
await new Promise((r) => setTimeout(r, 300));
const reg2 = JSON.parse(ext2.window.localStorage.getItem("null:ext") || "[]");
console.log("3. installed from the card:", reg2.map((e) => e.name + " v" + e.version).join(", "));
const home = await open(
  "index.html",
  SEED_COUNT + "localStorage.setItem('null:ext', " + JSON.stringify(JSON.stringify(reg2)) + ");",
  1600,
);
const hdoc = home.window.document;
console.log("   home chip:", !!hdoc.querySelector('[data-slot="nav"] .pc-chip'), "| 1s tickers:", home.window.__ticks());
console.log("   home toasts:", [...hdoc.querySelectorAll(".toast")].map((t) => t.textContent.trim()));
ext2.window.close();
home.window.close();

/* ---------- 4. labs ---------- */
const labs = await open("labs.html", null, 700);
console.log("4. lab tiles:", [...labs.window.document.querySelectorAll(".lab-stat")].map((s) => s.textContent.replace(/\s+/g, " ").trim()).join(" | "));
labs.window.close();

console.log("ERRORS:", errors.length ? errors : "none");
process.exit(0);
