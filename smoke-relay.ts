/* Runs the NAV shim from relay.ts in a fake sandbox and drives everything it
   installs. This is the code a copied page runs, so running it here is the
   only way to see it work without a browser. */

import { prepare } from "./src/lib/relay";

let bad = 0;
function ok(what: string, cond: boolean, extra = "") {
  if (!cond) bad += 1;
  console.log(`${cond ? "ok  " : "FAIL"} ${what}${extra ? ` — ${extra}` : ""}`);
}

const page = "<html><head><title>t</title></head><body><div id=root></div></body></html>";
const out = prepare(page, "https://aether.cx/");

ok("base tag points at the real site", out.includes('<base href="https://aether.cx/">'));
const found = out.match(/<script data-null="nav">([\s\S]*?)<\/script>/);
ok("the shim is inlined", !!found);
const src = found ? found[1] : "";

ok("the shim installs the bridge", src.includes("nullReq"));
ok("the shim takes over fetch", src.includes("window.fetch = function"));
ok("the shim takes over XHR", src.includes("window.XMLHttpRequest = BridgeXHR"));
ok("the shim offers a database", src.includes('defineProperty(window, "indexedDB"'));
ok("the shim reports what it can see", src.includes("nullSay"));

type Ask = { id: string; url: string; method: string; headers: Record<string, string>; body: string | null };
const sent: { nullReq?: Ask; nullErr?: string; nullSay?: { chars: number }; nullFrame?: string }[] = [];
const handlers: Record<string, ((e: unknown) => void)[]> = {};

/* One fake element, enough to be a link or a picture: the bridge reaches for
   tagName, the one attribute that failed and the place the answer goes. */
class El {
  tagName: string;
  attrs: Record<string, string> = {};
  textContent = "";
  constructor(tag: string) {
    this.tagName = tag.toUpperCase();
  }
  getAttribute(k: string): string | null {
    return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
  }
  setAttribute(k: string, v: string): void {
    this.attrs[k] = String(v);
  }
  removeAttribute(k: string): void {
    delete this.attrs[k];
  }
}

const win: Record<string, unknown> = {};
const poured: El[] = [];
const doc = {
  baseURI: "https://aether.cx/",
  body: { innerText: "aether" },
  documentElement: { appendChild: (el: El) => poured.push(el) },
  head: {
    prepend() {},
    appendChild: (el: El) => poured.push(el),
  },
  createElement: (tag: string) => new El(tag),
  addEventListener() {},
};

new Function("window", "document", "parent", "addEventListener", "indexedDB", src)(
  win,
  doc,
  { postMessage: (m: unknown) => sent.push(m as (typeof sent)[number]) },
  (k: string, fn: (e: unknown) => void) => {
    handlers[k] = handlers[k] || [];
    handlers[k].push(fn);
  },
  undefined,
);

const reply = (r: Record<string, unknown>) => (handlers.message || []).forEach((h) => h({ data: { nullRes: r } }));
const once = (req: { onsuccess: (() => void) | null }) => new Promise<void>((done) => {
  req.onsuccess = () => done();
});

/* ---- fetch ---- */
const f = (win.fetch as (u: string, i?: unknown) => Promise<Response>)("https://api.aether.cx/trending", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: '{"page":1}',
});
const fret = sent.find((m) => m.nullReq)?.nullReq;
ok("fetch went out over the bridge", !!fret, fret?.url);
ok("the method and body travelled", fret?.method === "POST" && fret?.body === '{"page":1}');
ok("the header travelled", fret?.headers?.["content-type"] === "application/json");

reply({
  id: fret?.id,
  status: 200,
  statusText: "OK",
  headers: [["content-type", "application/json"]],
  body: Buffer.from('{"ok":true}').toString("base64"),
  url: "https://api.aether.cx/trending",
});
const res = await f;
ok("the response comes back as a Response", res.status === 200);
ok("and its body decodes", (await res.text()) === '{"ok":true}');

/* ---- XHR ---- */
type FakeXhr = {
  open(m: string, u: string): void;
  send(b?: string): void;
  status: number;
  readyState: number;
  responseText: string;
  responseType: string;
  setRequestHeader(k: string, v: string): void;
  onload: (() => void) | null;
  getResponseHeader(k: string): string | null;
};
const XHR = win.XMLHttpRequest as new () => FakeXhr;
const xhr = new XHR();
let loaded = false;
xhr.onload = () => {
  loaded = true;
};
xhr.open("GET", "/api/row");
xhr.send();
const xreq = sent.map((m) => m.nullReq).filter(Boolean).at(-1);
ok("XHR went out over the bridge", !!xreq && xreq.url === "https://aether.cx/api/row", xreq?.url);
reply({ id: xreq?.id, status: 200, statusText: "OK", headers: [["x-one", "1"]], body: Buffer.from("hi there").toString("base64") });
await new Promise((r) => setTimeout(r, 20));
ok("XHR fired load", loaded);
ok("XHR has its status and text", xhr.status === 200 && xhr.responseText === "hi there", xhr.responseText);
ok("XHR has its headers", xhr.getResponseHeader("x-one") === "1");

/* ---- the storage shim ---- */
const store = win.localStorage as { setItem(k: string, v: string): void; getItem(k: string): string | null };
store.setItem("null:test", "1");
ok("localStorage reads back", store.getItem("null:test") === "1");

/* ---- the database ---- */
type IdbReq = {
  onsuccess: (() => void) | null;
  onupgradeneeded: ((e: { oldVersion: number; newVersion: number; target: { result: IdbDb } }) => void) | null;
  result: IdbDb;
};
type IdbStore = {
  put(v: unknown, k?: unknown): IdbReq;
  getAll(): IdbReq;
  get(k: unknown): IdbReq;
  createIndex(n: string, p: string): unknown;
};
type IdbTx = { objectStore(n: string): IdbStore; oncomplete: (() => void) | null };
type IdbDb = {
  version: number;
  objectStoreNames: string[] & { contains(n: string): boolean };
  createObjectStore(n: string, o: { keyPath?: string; autoIncrement?: boolean }): IdbStore;
  transaction(n: string[], m: string): IdbTx;
};

const idb = win.indexedDB as { open(n: string, v?: number): IdbReq };
const open = idb.open("saves", 1);
let upgraded = "";
open.onupgradeneeded = (e) => {
  upgraded = `${e.oldVersion}->${e.newVersion}`;
  e.target.result.createObjectStore("rows", { keyPath: "id" });
};
await once(open);
ok("a fresh database upgrades", upgraded === "0->1", upgraded);
ok("the store is there afterwards", open.result.objectStoreNames.contains("rows"));

const tx = open.result.transaction(["rows"], "readwrite");
let completed = false;
tx.oncomplete = () => {
  completed = true;
};
const put = tx.objectStore("rows").put({ id: 7, name: "seven" });
await once(put);
await new Promise((r) => setTimeout(r, 20));
ok("the write transaction completes", completed, "oncomplete fired");
ok("put answers with its key", put.result === 7, String(put.result));

const read = open.result.transaction(["rows"], "readonly");
const all = read.objectStore("rows").getAll();
await once(all);
ok("getAll hands back what was written", Array.isArray(all.result) && all.result.length === 1, JSON.stringify(all.result));

const reopen = idb.open("saves");
let upgradedAgain = false;
reopen.onupgradeneeded = () => {
  upgradedAgain = true;
};
await once(reopen);
ok("reopening does not upgrade again", !upgradedAgain);
const again = reopen.result.transaction(["rows"], "readonly").objectStore("rows").get(7);
await once(again);
ok("the data survived the reopen", !!again.result && again.result.name === "seven");

/* ---- the error report ---- */
(handlers.error || []).forEach((h) => h({ message: "SecurityError: IndexedDB is denied here" }));
ok("a page error is handed up", sent.some((m) => !!m.nullErr), sent.find((m) => m.nullErr)?.nullErr);

/* ---- a bridged failure rejects instead of hanging ---- */
const g = (win.fetch as (u: string) => Promise<Response>)("https://api.aether.cx/nope");
const greq = sent.map((m) => m.nullReq).filter(Boolean).at(-1);
reply({ id: greq?.id, error: "the relay refused" });
ok("a bridged failure rejects instead of hanging", await g.then(() => false, () => true));

/* ---- the asset bridge ----
   The half of a copied page that never went through the bridge: a picture, a
   stylesheet and a script are fetched by the frame itself, and on a filtered
   network they come back as nothing at all. What is checked here is that a
   resource which failed is asked for over the bridge, that what comes back is
   pointed at, and that it happens once rather than in a loop. */
async function wait(ms = 20) {
  await new Promise((r) => setTimeout(r, ms));
}
const last = () => sent.map((m) => m.nullReq).filter(Boolean).at(-1);
const err = (el: El) => (handlers.error || []).forEach((h) => h({ target: el }));
const png = Buffer.from("\x89PNG\r\n\x1a\n").toString("base64");

const img = new El("img");
img.setAttribute("src", "/art/cover.png");
err(img);
const ireq = last();
ok("a blocked picture is asked for over the bridge", ireq?.url === "https://aether.cx/art/cover.png", ireq?.url);
reply({ id: ireq?.id, status: 200, statusText: "OK", headers: [["content-type", "image/png"]], body: png });
await wait();
ok("and the element ends up pointing at what came back", /^(blob:|data:image\/png)/.test(img.getAttribute("src") || ""), img.getAttribute("src"));

err(img);
await wait();
ok("a second failure does not fetch it again", sent.filter((m) => m.nullReq?.url === "https://aether.cx/art/cover.png").length === 1);

/* a stylesheet is text, and everything it names is relative to the sheet */
const link = new El("link");
link.setAttribute("rel", "stylesheet");
link.setAttribute("href", "css/site.css");
err(link);
const sreq = last();
ok("a blocked stylesheet is asked for as text", sreq?.url === "https://aether.cx/css/site.css" && sreq?.headers?.accept === "text/css,*/*", sreq?.headers?.accept);
reply({ id: sreq?.id, status: 200, statusText: "OK", headers: [["content-type", "text/css"]], body: Buffer.from("body{background:url(bg.png)}").toString("base64") });
await wait();

const breq = last();
ok("the picture inside it is asked for relative to the sheet", breq?.url === "https://aether.cx/css/bg.png", breq?.url);
reply({ id: breq?.id, status: 200, statusText: "OK", headers: [["content-type", "image/png"]], body: png });
await wait();

const sheet = poured.at(-1);
ok("the sheet is poured into the page once it is whole", sheet?.tagName === "STYLE" && sheet.attrs["data-null-sheet"] === "https://aether.cx/css/site.css");
ok("and its own url()s point at what came back", !!sheet && /^body\{background:url\((blob:|data:)/.test(sheet.textContent), sheet?.textContent);

/* a script is bytes that have to run where they land, so it comes back as a
   blob this copy owns and the element is pointed at that */
const script = new El("script");
script.setAttribute("src", "js/app.js");
err(script);
const jreq = last();
reply({ id: jreq?.id, status: 200, statusText: "OK", headers: [["content-type", "text/javascript"]], body: Buffer.from("window.__ran=1").toString("base64") });
await wait();
ok("a blocked script is pointed at a blob of its own", /^blob:/.test(script.getAttribute("src") || ""), script.getAttribute("src"));

console.log(bad ? `\n${bad} failed` : "\nall good");
if (bad) process.exit(1);
