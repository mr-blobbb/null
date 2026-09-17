/* NULL · chromeext.ts
   Chrome extensions, as far as a web page is allowed to take them.

   What NULL can honestly do: open the .crx, read its manifest, keep it, show
   you exactly what it asks for, and run its popup and options pages in a
   sandboxed frame with a small `chrome` stand-in behind them.

   What it cannot do, and will not pretend to: content scripts injected into
   other sites, a background service worker running while NULL is closed,
   `webRequest`, `cookies`, `debugger`, or anything that reaches outside the
   frame. Those extensions install and sit there, marked dormant, with the
   reason printed on the card. That is the honest version of "installed but it
   will not work" — better than a button that quietly does nothing.

   The downloaded files live in memory for this session only. A reload leaves
   the extension listed and no longer runnable, which the card says too. */

import { createStore, useStore } from "./store";
import { openCrx, type Manifest, type Pack } from "./crx";

export type StoreExt = {
  id: string;
  name: string;
  version: string;
  desc: string;
  /** where it came from, printed on the card */
  from: string;
  /** how many files were read, so the card can say the download worked */
  files: number;
  permissions: string[];
  hosts: string[];
  hasPopup: boolean;
  /** false when a permission NULL cannot honour is on the list */
  runs: boolean;
  /** why it does not run, in one sentence */
  why: string | null;
  at: number;
};

export const chromeExt = createStore<{ list: StoreExt[] }>("chromeext", { list: [] });

export function useChromeExt(): StoreExt[] {
  return useStore(chromeExt).list;
}

/* ---------- what NULL will not do ---------- */

const PRIVILEGED = [
  "debugger",
  "nativeMessaging",
  "proxy",
  "webRequest",
  "webRequestBlocking",
  "declarativeNetRequest",
  "declarativeNetRequestWithHostAccess",
  "cookies",
  "management",
  "history",
  "bookmarks",
  "downloads",
  "clipboardRead",
  "geolocation",
  "unlimitedStorage",
];

const BROAD_HOSTS = ["<all_urls>", "*://*/*", "http://*/*", "https://*/*"];

function triage(m: Manifest): { runs: boolean; why: string | null } {
  const perms = m.permissions ?? [];
  const blocked = perms.filter((p) => PRIVILEGED.includes(p));
  if (blocked.length) {
    return { runs: false, why: `asks for ${blocked.join(", ")}, which a web page cannot give it` };
  }
  if ((m.host_permissions ?? []).some((h) => BROAD_HOSTS.includes(h))) {
    return { runs: false, why: "asks to read every site you visit, which a web page cannot give it" };
  }
  if (m.background?.service_worker || m.background?.scripts?.length) {
    /* The popup can still run; only the worker is missing. Call that out
       rather than refusing the whole install. */
    return { runs: true, why: "its background worker is not started — NULL has nowhere to run one" };
  }
  if (m.content_scripts?.length) {
    return { runs: true, why: "its content scripts are not injected into pages — only its own pages run here" };
  }
  return { runs: true, why: null };
}

/* ---------- the packs ---------- */

/* Keyed by extension id. Deliberately not persisted: a multi-megabyte pack in
   localStorage would blow the quota, and a stale half-read one is worse than
   none. */
const packs = new Map<string, Pack>();
const urls = new Map<string, string[]>();

export function packOf(id: string): Pack | undefined {
  return packs.get(id);
}

export function isLoaded(id: string): boolean {
  return packs.has(id);
}

const decoder = new TextDecoder();

const MIME: Record<string, string> = {
  js: "text/javascript",
  mjs: "text/javascript",
  css: "text/css",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  woff: "font/woff",
  woff2: "font/woff2",
  wasm: "application/wasm",
};

/** A file from the pack, as something the browser can load. `Uint8Array` and
 *  `BlobPart` disagree about shared buffers in the type system, not at
 *  runtime, so the cast is the honest way to say that. */
function blobOf(bytes: Uint8Array, type: string): Blob {
  return new Blob([bytes as unknown as BlobPart], { type });
}

function blobUrl(id: string, path: string): string {
  const pack = packs.get(id);
  const bytes = pack?.files.get(path);
  if (!bytes) return "";
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const url = URL.createObjectURL(blobOf(bytes, MIME[ext] ?? "application/octet-stream"));
  const held = urls.get(id) ?? [];
  held.push(url);
  urls.set(id, held);
  return url;
}

/** Take an extension's bytes, read it, and file it. */
export async function installBytes(bytes: Uint8Array, from: string, id: string): Promise<StoreExt> {
  const pack = await openCrx(bytes);
  const m = pack.manifest;
  const { runs, why } = triage(m);
  packs.set(id, pack);

  const card: StoreExt = {
    id,
    name: (m.name ?? "Unnamed extension").slice(0, 60),
    version: m.version ?? "0",
    desc: (m.description ?? "No description in its manifest.").slice(0, 240),
    from,
    files: pack.files.size,
    permissions: [...(m.permissions ?? []), ...(m.optional_permissions ?? []).map((p) => `${p}?`)],
    hosts: m.host_permissions ?? [],
    hasPopup: !!pack.popup,
    runs,
    why,
    at: Date.now(),
  };

  const s = chromeExt.get();
  chromeExt.set({ list: [card, ...s.list.filter((e) => e.id !== id)] });
  return card;
}

export function uninstallExt(id: string) {
  packs.delete(id);
  for (const u of urls.get(id) ?? []) URL.revokeObjectURL(u);
  urls.delete(id);
  chromeExt.set({ list: chromeExt.get().list.filter((e) => e.id !== id) });
}

/** An id that is stable for the same extension and is not the Web Store's:
 *  NULL has no business claiming to be Chrome's registry. */
export function idFor(name: string, version: string): string {
  const s = `${name}@${version}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return `null-${(h >>> 0).toString(36)}`;
}

/* ---------- the stand-in ---------- */

/** The `chrome` object the extension's own pages see. Everything it does not
 *  implement throws with a sentence rather than returning undefined, so a
 *  broken extension says why it is broken. Storage is proxied to the parent
 *  frame because a sandboxed page has no localStorage of its own. */
export function chromeShim(id: string, name: string, version: string): string {
  return `(function(){
  var ID = ${JSON.stringify(id)};
  var MANIFEST = { manifest_version: 3, name: ${JSON.stringify(name)}, version: ${JSON.stringify(version)}, id: ID };
  var seq = 0, waiting = {};
  function ask(op, args){
    return new Promise(function(resolve, reject){
      var n = ++seq;
      waiting[n] = { resolve: resolve, reject: reject };
      parent.postMessage({ nullExt: ID, n: n, op: op, args: args || {} }, "*");
    });
  }
  window.addEventListener("message", function(e){
    var d = e.data;
    if (!d || d.nullExtReply === undefined) return;
    var w = waiting[d.nullExtReply];
    if (!w) return;
    delete waiting[d.nullExtReply];
    if (d.error) w.reject(new Error(d.error)); else w.resolve(d.value);
  });
  function area(kind){
    return {
      get: function(keys, cb){
        var p = ask("get", { area: kind, keys: keys === undefined ? null : keys });
        if (cb) { p.then(cb); return; }
        return p;
      },
      set: function(items, cb){
        var p = ask("set", { area: kind, items: items });
        if (cb) { p.then(function(){ cb(); }); return; }
        return p;
      },
      remove: function(keys, cb){
        var p = ask("remove", { area: kind, keys: keys });
        if (cb) { p.then(function(){ cb(); }); return; }
        return p;
      },
      clear: function(cb){
        var p = ask("clear", { area: kind });
        if (cb) { p.then(function(){ cb(); }); return; }
        return p;
      }
    };
  }
  function nope(what){
    return function(){ throw new Error("NULL does not provide chrome." + what + " to extensions"); };
  }
  var chrome = {
    runtime: {
      id: ID,
      getManifest: function(){ return MANIFEST; },
      getURL: function(p){ return "null-extension://" + ID + "/" + String(p || "").replace(/^\\//, ""); },
      lastError: undefined,
      sendMessage: function(){ return Promise.resolve(undefined); },
      onMessage: { addListener: function(){}, removeListener: function(){} },
      onInstalled: { addListener: function(){} },
      connect: nope("runtime.connect")
    },
    storage: { local: area("local"), sync: area("sync"), session: area("local"), onChanged: { addListener: function(){} } },
    i18n: { getMessage: function(k){ return k; }, getUILanguage: function(){ return navigator.language; } },
    tabs: { query: function(){ return Promise.resolve([]); }, create: nope("tabs.create"), update: nope("tabs.update") },
    permissions: { contains: function(){ return Promise.resolve(false); }, request: function(){ return Promise.resolve(false); } },
    action: { setBadgeText: function(){}, setBadgeBackgroundColor: function(){}, setIcon: function(){}, setTitle: function(){} },
    alarms: { create: function(){}, clear: function(){}, onAlarm: { addListener: function(){} } },
    windows: { getCurrent: function(){ return Promise.resolve({ id: 1 }); } },
    bookmarks: nope("bookmarks"), cookies: nope("cookies"), webRequest: nope("webRequest"),
    declarativeNetRequest: nope("declarativeNetRequest"), scripting: nope("scripting"), debugger: nope("debugger")
  };
  window.chrome = chrome;
  window.browser = chrome;
})();`;
}

/** Build the extension's popup as a page NULL can show: every relative asset
 *  swapped for a blob of the file from the pack, and the stand-in injected
 *  before anything the extension ships runs. */
export function buildPage(id: string): { url: string; title: string } | null {
  const pack = packs.get(id);
  if (!pack?.popup) return null;
  const bytes = pack.files.get(pack.popup);
  if (!bytes) return null;

  const dir = pack.popup.includes("/") ? pack.popup.slice(0, pack.popup.lastIndexOf("/") + 1) : "";
  const doc = new DOMParser().parseFromString(decoder.decode(bytes), "text/html");
  const local = (p: string) => !/^(https?:|data:|blob:|#|mailto:)/i.test(p);

  doc.querySelectorAll("[src]").forEach((el) => {
    const v = el.getAttribute("src");
    if (v && local(v)) el.setAttribute("src", blobUrl(id, dir + v.replace(/^\.\//, "")));
  });
  doc.querySelectorAll("link[href]").forEach((el) => {
    const v = el.getAttribute("href");
    if (v && local(v)) el.setAttribute("href", blobUrl(id, dir + v.replace(/^\.\//, "")));
  });

  /* an inline script must run before the extension's own, so it goes first in
     the head — the extension will not find `chrome` otherwise */
  const shim = doc.createElement("script");
  shim.textContent = chromeShim(id, pack.manifest.name ?? "extension", pack.manifest.version ?? "0");
  (doc.head ?? doc.documentElement).prepend(shim);

  const html = `<!doctype html>${doc.documentElement.outerHTML}`;
  const url = URL.createObjectURL(blobOf(new TextEncoder().encode(html), "text/html"));
  const held = urls.get(id) ?? [];
  held.push(url);
  urls.set(id, held);

  return { url, title: pack.manifest.action?.default_title ?? pack.manifest.name ?? "Extension" };
}
