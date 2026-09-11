/* Audit the Settings page end-to-end: render settings.html with its real
   scripts in jsdom and make sure every card, control, accent swatch, tab
   preset, theme pack and particle actually shows up — nothing silently
   missing, empty or unbound. */
const fs = require("fs");
const { JSDOM } = require("jsdom");

let failures = 0;
function check(name, ok) {
  console.log((ok ? "ok  " : "FAIL") + "  " + name);
  if (!ok) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function injectPage(file) {
  let html = fs.readFileSync(file, "utf8");
  const css =
    fs.readFileSync("src/styles/global.css", "utf8") +
    "\n" +
    fs.readFileSync("src/styles/extra.css", "utf8");
  html = html.replace(/<link rel="stylesheet" href="\/src\/styles\/extra\.css">/, "");
  html = html.replace(
    '<link rel="stylesheet" href="/src/styles/global.css">',
    "<style>" + css + "</style>",
  );
  return html.replace(/<script src="(\/src\/[^"]+)"><\/script>/g, (m, src) => {
    const p = src.split("?")[0].replace(/^\//, "");
    if (!fs.existsSync(p)) return "";
    return "<script>" + fs.readFileSync(p, "utf8") + "</script>";
  });
}

/* the cards that must be on the page, and how much real text each needs */
const CARDS = [
  ["Appearance", "half"],
  ["Glow border", "half"],
  ["Theme packs", "wide"],
  ["Background particles", "wide"],
  ["Seasonal theme", "half"],
  ["Install NULL", "half"],
  ["Browser tab presets", "wide"],
  ["Library extras", "half"],
  ["Privacy & cloaking", "half"],
  ["Your data", "wide"],
  ["Panic key", "wide"],
  ["Danger zone", "wide"],
];

/* every interactive control settings.js binds by id */
const CONTROLS = [
  "themeSeg",
  "accentRow",
  "accentCustomRow",
  "accentCustom",
  "perfSwitch",
  "glowSelect",
  "cometSwitch",
  "glowColor1",
  "glowColor2",
  "packGrid",
  "partGrid",
  "seasonalSwitch",
  "installBtn",
  "installHelp",
  "tabSelect",
  "tabPrev",
  "smartTabSwitch",
  "smartTabMin",
  "tabCustomWrap",
  "tabCustomTitle",
  "tabCustomIcon",
  "gmailWrap",
  "gmailAddr",
  "recsSwitch",
  "marathonSwitch",
  "confettiSwitch",
  "dataInfo",
  "btnCloakBlank",
  "btnCloakBlob",
  "btnDataExport",
  "btnDataImport",
  "dataFile",
  "panicKey",
  "panicUrl",
  "panicSwitch",
  "dangerReset",
  "dangerWipe",
];

(async function main() {
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
  await wait(500);
  const d = w.document;

  check("settings renders without window errors", errs.length === 0);

  /* ---------- every card is present, in order, and has content ---------- */
  const cards = Array.from(d.querySelectorAll(".set-grid > .set-card"));
  check("all settings cards present (" + cards.length + ")", cards.length === CARDS.length);
  CARDS.forEach(([title, span], i) => {
    const card = cards[i];
    if (!card) {
      check("card: " + title, false);
      return;
    }
    /* the title element also holds the icon ligature, e.g. "editTheme packs" */
    const head = (card.querySelector(".set-title, .dz-head") || { textContent: "" }).textContent.trim();
    const wide = card.classList.contains("set-card--wide");
    const ok = head.endsWith(title) && wide === (span === "wide") && card.textContent.trim().length > 60;
    check("card " + (i + 1) + " is " + title, ok);
    if (!ok) console.log("     got head=" + JSON.stringify(head) + " wide=" + wide + " len=" + card.textContent.trim().length);
  });

  /* ---------- every control the page binds actually exists ---------- */
  const missing = CONTROLS.filter((id) => !d.getElementById(id));
  check("all " + CONTROLS.length + " controls present", missing.length === 0);
  if (missing.length) console.log("     missing:", missing.join(", "));

  /* ---------- dynamic rows filled by settings.js ---------- */
  check(
    "accent swatches built (" + d.querySelectorAll("#accentRow .swatch-btn").length + ")",
    d.querySelectorAll("#accentRow .swatch-btn").length === w.N.theme.ACCENTS.length,
  );
  check(
    "tab presets listed (" + d.querySelectorAll("#tabSelect option").length + ")",
    d.querySelectorAll("#tabSelect option").length === w.N.tab.list.length,
  );
  check(
    "every theme pack carded (" + d.querySelectorAll("#packGrid .pack-card").length + ")",
    d.querySelectorAll("#packGrid .pack-card").length === w.N.theme.allPacks().length,
  );
  check(
    "every particle carded (" + d.querySelectorAll("#partGrid .pack-card").length + ")",
    d.querySelectorAll("#partGrid .pack-card").length === w.N.theme.allParticles().length,
  );
  check(
    "pack + particle cards all have a preview",
    d.querySelectorAll("#packGrid .pack-preview").length === w.N.theme.allPacks().length &&
      d.querySelectorAll("#partGrid .part-preview").length === w.N.theme.allParticles().length,
  );
  const lockedPacks = d.querySelectorAll("#packGrid .pack-card.locked").length;
  const lockedParts = d.querySelectorAll("#partGrid .pack-card.locked").length;
  check(
    "every locked card carries a lock badge but keeps its preview",
    lockedPacks > 0 &&
      lockedParts > 0 &&
      d.querySelectorAll("#packGrid .pack-lock").length === lockedPacks &&
      d.querySelectorAll("#partGrid .part-lock").length === lockedParts &&
      d.querySelectorAll("#packGrid .pack-card.locked .pack-preview").length === lockedPacks,
  );
  check("local data summary is filled in", /recent .* favorites/.test(d.getElementById("dataInfo").textContent));
  check(
    "theme + performance rows reflect the saved prefs",
    d.querySelectorAll("#themeSeg button.on").length === 1 &&
      d.getElementById("perfSwitch").checked === false,
  );

  w.close();
  console.log(failures ? "FAILURES: " + failures : "ALL SETTINGS CHECKS PASS");
  process.exit(failures ? 1 : 0);
})();
