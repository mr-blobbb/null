/* NULL · build-icons.js
   Vendors the icon set NULL draws with.

   The site used to render its icons from a subsetted icon *font*, which meant
   a glyph was a codepoint, and every icon had to be looked up in a build step
   before it could be drawn. Now the drawings ship as plain SVG path data in a
   generated module: no font request, no FOUT, and the same file works offline
   on GitHub Pages.

   The set is Lucide (ISC, https://lucide.dev) — an actual maintained icon
   library rather than drawings made up per screen. `MAP` below is the only
   hand-written part: NULL's own names on the left, Lucide's file names on the
   right. Add a line here and the icon is available everywhere.

   Run: bun run icons   (writes src/utilities/icons.generated.js) */

import fs from "node:fs";
import path from "node:path";

const DIR = "node_modules/lucide-static/icons";
const OUT = "src/utilities/icons.generated.js";

/* NULL's name -> Lucide's name */
const MAP = {
  /* the rail and the sheets */
  home: "house",
  games: "gamepad-2",
  game: "gamepad-2",
  apps: "link",
  link: "link",
  grid: "layout-grid",
  proxy: "globe",
  globe: "globe",
  bag: "shopping-bag",
  shop: "shopping-bag",
  person: "user-round",
  user: "user-round",
  scroll: "scroll-text",
  puzzle: "puzzle",
  sliders: "sliders-horizontal",
  settings: "settings",
  ann: "megaphone",
  sched: "calendar-days",
  backups: "archive",

  /* controls and chrome */
  search: "search",
  x: "x",
  check: "check",
  plus: "plus",
  minus: "minus",
  menu: "menu",
  back: "arrow-left",
  arrowL: "arrow-left",
  arrowR: "arrow-right",
  arrowU: "arrow-up",
  arrowD: "arrow-down",
  chevD: "chevron-down",
  chevR: "chevron-right",
  chevU: "chevron-up",
  chevL: "chevron-left",
  up: "arrow-up",
  down: "arrow-down",
  refresh: "refresh-cw",
  max: "maximize",
  min: "minimize",
  ban: "ban",
  ext: "external-link",
  more: "ellipsis",
  dots: "ellipsis-vertical",
  sync: "refresh-cw",

  /* media */
  play: "play",
  pause: "pause",
  stop: "square",
  vol: "volume-2",
  mute: "volume-x",
  dice: "dices",

  /* files, data, sharing */
  file: "file-text",
  folder: "folder",
  save: "save",
  copy: "copy",
  upload: "upload",
  download: "download",
  cloudUp: "cloud-upload",
  cloudDown: "cloud-download",
  trash: "trash-2",
  pen: "pencil",
  pencil: "pencil",
  camera: "camera",
  image: "image",
  palette: "palette",
  code: "code",
  terminal: "terminal",
  box: "package",
  layers: "layers",
  wifi: "wifi",
  wisp: "radio-tower",
  bug: "bug",

  /* the shop */
  coin: "circle-dollar-sign",
  coins: "circle-dollar-sign",
  gift: "gift",
  tag: "tag",
  sparkle: "sparkles",
  sparkles: "sparkles",
  star: "star",
  trophy: "trophy",
  lock: "lock",
  unlock: "lock-open",
  key: "key",
  crown: "crown",
  store: "store",
  boost: "rocket",
  trend: "trending-up",
  cart: "shopping-cart",
  wallet: "wallet",
  ticket: "ticket",
  receipt: "receipt",

  /* everything else */
  clock: "clock",
  clock2: "timer",
  timer: "timer",
  watch: "watch",
  calendar: "calendar",
  sun: "sun",
  moon: "moon",
  leaf: "leaf",
  snow: "snowflake",
  petal: "flower",
  flame: "flame",
  drop: "droplet",
  zap: "zap",
  bolt: "zap",
  wrench: "wrench",
  tool: "wrench",
  hammer: "hammer",
  beaker: "flask-conical",
  school: "graduation-cap",
  book: "book-open",
  scale: "scale",
  cookie: "cookie",
  info: "info",
  warn: "triangle-alert",
  help: "circle-help",
  shield: "shield",
  eye: "eye",
  eyeOff: "eye-off",
  heart: "heart",
  bell: "bell",
  flag: "flag",
  pin: "pin",
  mail: "mail",
  send: "send",
  share: "share-2",
  rss: "rss",
  user2: "users",
  users: "users",
  logout: "log-out",
  logoutIn: "log-in",
  chrome: "app-window",
  firefox: "flame",
  list: "list",
  filter: "list-filter",
  sort: "arrow-up-down",
  shuffle: "shuffle",
  spark: "zap",
  cpu: "cpu",
  gauge: "gauge",
  activity: "activity",
  map: "map-pin",
  compass: "compass",
  music: "music",
  qr: "qr-code",
  scan: "scan",
  keyboard: "keyboard",
  monitor: "monitor",
  laptop: "laptop",
  phone: "smartphone",
  mouse: "mouse-pointer",
  game2: "joystick",
};

const missing = [];
function inner(lucideName) {
  const file = path.join(DIR, lucideName + ".svg");
  if (!fs.existsSync(file)) {
    missing.push(lucideName);
    return null;
  }
  const svg = fs.readFileSync(file, "utf8");
  const body = svg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>[\s\S]*$/, "")
    .replace(/\s+/g, " ")
    .replace(/>\s+</g, "><")
    .trim();
  return body;
}

const out = {};
for (const key of Object.keys(MAP).sort()) {
  const body = inner(MAP[key]);
  if (body) out[key] = body;
}

if (missing.length) {
  console.error("build-icons: no such Lucide icon: " + missing.join(", "));
  process.exit(1);
}

const version = JSON.parse(fs.readFileSync("node_modules/lucide-static/package.json", "utf8")).version;

const file =
  "/* NULL · icons.generated.js — GENERATED, do not edit.\n" +
  "   Lucide " + version + " (ISC, https://lucide.dev), one entry per icon: the\n" +
  "   contents of the icon's <svg> on a 24x24 grid, stroked in currentColor.\n" +
  "   Rebuild with `bun run icons` after editing scripts/build-icons.js. */\n" +
  "(function () {\n" +
  "  var N = (window.N = window.N || {});\n" +
  "  N.lucide = " + JSON.stringify(out, null, 2).replace(/\n/g, "\n  ") + ";\n" +
  "})();\n";

fs.writeFileSync(OUT, file);
console.log(
  "build-icons: " + Object.keys(out).length + " icons from Lucide " + version + " → " + OUT,
);
