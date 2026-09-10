/* Throwaway verification: run the real NULL browser files (dom.js, catalog,
   cards.js) through a minimal DOM shim and render one card per game. */
const fs = require("fs");

// ---------- minimal DOM ----------
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.style = {};
    this.dataset = {};
    this._cls = new Set();
    this.listeners = {};
    this.text = "";
    this.parentNode = null;
  }
  set className(v) { this._cls = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get className() { return [...this._cls].join(" "); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); }
  appendChild(c) {
    if (typeof c === "string") c = { nodeType: 3, text: c, parentNode: this };
    c.parentNode = this;
    this.children.push(c);
    return c;
  }
  replaceWith(el) { el.parentNode = this.parentNode; }
  remove() { this.parentNode = null; }
  classList = {
    add: (c) => this._cls.add(c),
    remove: (c) => this._cls.delete(c),
    toggle: (c, on) => (on === undefined ? (this._cls.has(c) ? this._cls.delete(c) : this._cls.add(c)) : on ? this._cls.add(c) : this._cls.delete(c)),
    contains: (c) => this._cls.has(c),
  };
  set textContent(v) { this.text = String(v); this.children = []; }
  get textContent() { return this.text; }
  set innerHTML(v) { this.text = String(v); }
  querySelector() { return null; }
}

global.document = {
  createElement: (t) => new El(t),
  createTextNode: (s) => ({ nodeType: 3, text: String(s), parentNode: null }),
  querySelector: () => null,
  querySelectorAll: () => [],
  body: new El("body"),
  addEventListener: () => {},
  readyState: "complete",
};
global.window = global;
global.location = { href: "/games", search: "", pathname: "/games" };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, length: 0, key: () => null };
global.requestAnimationFrame = (fn) => fn();
global.URLSearchParams = require("url").URLSearchParams;
global.fetch = () => Promise.reject(new Error("no fetch"));

// ---------- load real files ----------
const load = (p) => {
  const code = fs.readFileSync(p, "utf8");
  const fn = new Function("window", "document", "location", "localStorage", "fetch", "URLSearchParams", code + "\n;return window.N;");
  return fn(global, global.document, global.location, global.localStorage, global.fetch, global.URLSearchParams);
};
load("src/utilities/store.js");
const N = load("src/utilities/dom.js");
load("src/catalog/generated-catalog.js");
load("src/catalog/catalog.js");
load("src/components/cards.js");

// ---------- render every game card ----------
const games = N.catalog.games();
console.log("games in catalog:", games.length);
let allOk = true;
games.forEach((g) => {
  const card = N.cards.card(g, "game");
  const names = [];
  const walk = (n) => {
    if (n.nodeType === 3) names.push(n.text);
    else (n.children || []).forEach(walk);
  };
  walk(card);
  const text = names.join("").trim();
  const ok = text.indexOf(g.name) === 0;
  if (!ok) allOk = false;
  console.log((ok ? "OK  " : "MISS") + " " + g.id + " -> name is first text on card: " + JSON.stringify(g.name) + (ok ? "" : " (got " + JSON.stringify(text.slice(0, 40)) + "...)"));
});
console.log(allOk ? "ALL GAME NAMES RENDER" : "SOME NAMES MISSING");