const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const root = process.env.PROJ;
const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
  url: "http://localhost:5173/",
  runScripts: "dangerously",
});
const win = dom.window;
const doc = win.document;

["src/utilities/store.js", "src/utilities/theme.js"].forEach((f) => {
  win.eval(fs.readFileSync(path.join(root, f), "utf8"));
});

const T = win.N.theme;
console.log("GLOWS:", T.GLOWS.map((g) => g.id).join(","));
console.log("default glow:", win.N.prefs.get("glow"));

function apply(id) {
  win.N.prefs.set("glow", id);
  T.setGlow(id);
  const style = doc.getElementById("null-glow");
  console.log("apply", id, "-> data-glow:", doc.documentElement.dataset.glow,
    "| style?", !!style, "| css len:", style ? style.textContent.length : 0,
    "| c1:", doc.documentElement.style.getPropertyValue("--glow-c1"));
}

apply("spring");
apply("rainbow");
apply("nebula");
apply("custom");
win.N.prefs.set("glowColor1", "#ff0000");
win.N.prefs.set("glowColor2", "#00ff00");
apply("custom");
apply("off");
console.log("after off -> data-glow:", doc.documentElement.dataset.glow,
  "| style present?", !!doc.getElementById("null-glow"));
process.exit(0);