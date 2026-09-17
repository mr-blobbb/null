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

const win: Record<string, unknown> = {};
const doc = {
  baseURI: "https://aether.cx/",
  body: { innerText: "aether" },
  head: { prepend() {} },
  createElement: () => ({}),
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

console.log(bad ? `\n${bad} failed` : "\nall good");
if (bad) process.exit(1);
