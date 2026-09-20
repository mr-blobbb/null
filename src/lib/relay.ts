/* NULL · relay.ts
   The second road into a site: read the page itself, draw it here.

   Ultraviolet is the first road — it rewrites every request inside a service
   worker. That is the better one, and it is what the window uses whenever it
   can register a worker. But a service worker is not always available (a page
   inside someone else's frame, a browser that refuses one, an origin that is
   not ours to control), and when it is not there the old answer was a dead
   end.

   So: ask the relay for the page over the same transport Ultraviolet uses,
   put a <base> in it so its own scripts, styles and pictures resolve against
   the real origin, and draw the result in a sandboxed frame. The far site is
   never *framed* — it is copied — so a site that refuses to be framed, which
   is exactly what aether.cx does with `x-frame-options: DENY`, never gets the
   chance to refuse.

   The frame is opaque on purpose: `allow-scripts` lets the copy run, and the
   absence of `allow-same-origin` means the copy can never touch NULL — no
   reading our storage, no navigating this window. Navigation it *wants* to do
   comes back as a message, and the window fetches the new address the same
   way. What the copy cannot do without an origin, it cannot do; that line is
   worth more than a page that half works. */

import { candidates, clientFor } from "./browser";

export type Read = { ok: true; html: string; relay: string } | { ok: false; reason: string };

/** Normalize an upstream response for a same-origin copied page. Entity and
 * caching headers are retained; only headers that would isolate or frame-block
 * the copy are removed. */
export function rewriteUpstreamHeaders(source: Headers, url = ""): [string, string][] {
  const blocked = /^(x-frame-options|content-security-policy(?:-report-only)?|cross-origin-(?:opener|embedder|resource)-policy|origin-agent-cluster|set-cookie|content-length|content-encoding)$/i;
  const out: [string, string][] = [];
  source.forEach((value, key) => {
    if (!blocked.test(key)) out.push([key, value]);
  });
  out.push(["access-control-allow-origin", "*"]);
  if (/\\.wasm(?:$|\\?)/i.test(url) && !out.some(([key]) => key.toLowerCase() === "content-type")) {
    out.push(["content-type", "application/wasm"]);
  }
  return out;
}

/** One attempt through one relay. Split out so the walk over the list can be
 *  the only thing with a loop in it. */
async function once(url: string, relay: string): Promise<Read> {
  /* clientFor wires the transport only when this relay is not already the
     live one, so a booted window pays nothing for the second road */
  const client = await clientFor(relay);
  const res = await client.fetch(url, {
    headers: {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
  } as RequestInit);

  if (res.status >= 400 && res.status !== 403) {
    return { ok: false, reason: `The site answered ${res.status} ${res.statusText}.` };
  }
  const html = await res.text();
  if (!html.trim()) return { ok: false, reason: "The site answered with an empty page." };
  return { ok: true, html, relay };
}

/** A page, fetched by the relay instead of by this document. Every relay the
 *  site knows about gets a turn, because a relay that has quietly stopped
 *  answering is the single most common reason a page does not load here. */
export async function read(url: string, relay: string): Promise<Read> {
  const order = candidates(relay);
  if (!order.length) return { ok: false, reason: "No relay is set, so there is nothing to fetch through." };

  const tried: string[] = [];
  for (const r of order) {
    try {
      const got = await once(url, r);
      if (got.ok) return got;
      tried.push(`${r} (${got.reason})`);
    } catch (e) {
      tried.push(`${r} (${(e as Error).message})`);
    }
  }
  return { ok: false, reason: `The relay could not fetch it. Tried ${tried.join(", ")}.` };
}

/* ---------- the copy ----------
   Three edits, each with a reason:

   · a <base> so every relative URL in the page resolves to the real site
     rather than to NULL's own address;
   · any Content-Security-Policy meta removed, because a page loaded from
     here is not on its own origin and a policy written for that origin would
     blank the copy;
   · `integrity` attributes dropped, because a subresource fetched through a
     different road will not hash the way the page expects.

   Then two more things, both about the same problem: the copy has no origin.

   · a storage shim. A sandboxed frame has an opaque origin, so `localStorage`
     throws on *access* — not on write — and a site that reads a key on boot
     dies before it draws. The shim is an in-memory store that reports
     success, which is enough for the settings-and-migration code most sites
     run on load, and it is deliberately per-frame so two copies cannot read
     each other's keys.

   · a network bridge. The same opaque origin means the copy's own `fetch`
     goes out as `Origin: null` and anything that looks at the origin refuses
     it, so a site that is nothing but a JavaScript app fetches nothing and
     draws nothing. Every request the copy makes over `fetch` or `XMLHttpRequest`
     is sent up to the window that owns the relay instead, made there, and
     handed back. That window — not the copy — is where the request is allowed
     to happen. */

/* The shim is one template literal, so nothing inside it may use a backtick
   or an interpolation — comments included. A backtick in one of these
   comments once ended the literal early and took the build down with it.

   The same rule reaches further than quotes: every backslash in this string
   is an escape, so a regular expression written here needs two. One went into
   a url() pattern, arrived at the browser as half of itself and threw on
   parse, which is why the asset bridge below spells its patterns with doubled
   backslashes. */
const NAV = `<script data-null="nav">(function(){
  function out(u){ try { parent.postMessage({ nullFrame: String(u) }, "*"); } catch (e) {} }

  /* an in-memory store that reports success, so a site that writes on boot
     keeps going instead of throwing */
  var mem = {};
  var api = {
    getItem: function(k){ return Object.prototype.hasOwnProperty.call(mem, String(k)) ? mem[String(k)] : null; },
    setItem: function(k,v){ mem[String(k)] = String(v); },
    removeItem: function(k){ delete mem[String(k)]; },
    clear: function(){ mem = {}; },
    key: function(i){ return Object.keys(mem)[i] || null; }
  };
  try { Object.defineProperty(api, "length", { get: function(){ return Object.keys(mem).length; } }); } catch (e) {}
  try { Object.defineProperty(window, "localStorage", { value: api, configurable: true }); } catch (e) {}
  try { Object.defineProperty(window, "sessionStorage", { value: api, configurable: true }); } catch (e) {}

  /* A copied page must not register a worker against NULL's origin. Expose a
     small same-page registration facade instead: it preserves the common
     register/ready/unregister contract while requests remain on this copy's
     bridge. This prevents service-worker boot code from aborting the app. */
  try {
    if (window.navigator && window.navigator.serviceWorker) {
      var sw = window.navigator.serviceWorker;
      var registration = { scope: document.baseURI, active: null, installing: null, waiting: null, unregister: function(){ return Promise.resolve(true); }, update: function(){ return Promise.resolve(); } };
      sw.register = function(){ return Promise.resolve(registration); };
      sw.ready = Promise.resolve(registration);
      sw.getRegistrations = function(){ return Promise.resolve([registration]); };
    }
  } catch (e) {}

  /* ---------- a place to keep things ----------
     An opaque origin has no Indexed Database at all. Asking for one throws a
     SecurityError the moment a page touches it, and a page whose persistence
     layer throws while it mounts unmounts itself and shows nothing at all.
     This is the same interface over plain objects — memory instead of disk,
     so it lasts as long as the page does, which is the trade for a page that
     draws. Only installed where the real one refuses to work. */
  function idbWorks() {
    try {
      var probe = indexedDB.open("__null_probe__");
      try { indexedDB.deleteDatabase("__null_probe__"); } catch (e) {}
      return !!probe;
    } catch (e) {
      return false;
    }
  }
  if (!idbWorks()) {
    var DBS = {};

    function newRequest() {
      var r = {
        result: undefined, error: null, readyState: "pending", source: null, transaction: null,
        onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null, _h: {}
      };
      r.addEventListener = function (k, fn) { (r._h[k] = r._h[k] || []).push(fn); };
      r.removeEventListener = function () {};
      r._fire = function (kind, extra) {
        r.readyState = "done";
        var ev = { type: kind, target: r, currentTarget: r };
        if (extra) for (var k in extra) ev[k] = extra[k];
        var odd = r["on" + kind];
        if (typeof odd === "function") { try { odd.call(r, ev); } catch (e) {} }
        (r._h[kind] || []).forEach(function (fn) { try { fn.call(r, ev); } catch (e) {} });
      };
      return r;
    }

    function keyList(meta) {
      return Object.keys(meta.rows).map(function (k) {
        return ((String(Number(k)) === k) && k !== "") ? Number(k) : k;
      }).sort(function (a, b) {
        if (typeof a === "number" && typeof b === "number") return a - b;
        return String(a) < String(b) ? -1 : 1;
      });
    }

    function keyFor(meta, value, given) {
      if (given !== undefined && given !== null) return given;
      var k = meta.keyPath && value != null ? value[meta.keyPath] : undefined;
      if (k !== undefined && k !== null) return k;
      if (!meta.auto) return undefined;
      k = meta.next++;
      if (meta.keyPath && value != null) value[meta.keyPath] = k;
      return k;
    }

    function settle(t, work, kind) {
      var r = newRequest();
      r.transaction = t;
      r.source = work.source;
      setTimeout(function () {
        try {
          r.result = work();
          r._fire("success");
        } catch (e) {
          r.error = e;
          r._fire("error");
        }
        if (t) t._settle(kind);
      }, 0);
      return r;
    }

    function makeStore(meta, t) {
      var s = {
        name: meta.name, keyPath: meta.keyPath, autoIncrement: meta.auto,
        indexNames: Object.keys(meta.index)
      };
      s.put = function (value, given) {
        return settle(t, function () { var k = keyFor(meta, value, given); meta.rows[String(k)] = value; return k; });
      };
      s.add = s.put;
      s.get = function (key) { return settle(t, function () { return meta.rows[String(key)]; }); };
      s.getAll = function () { return settle(t, function () { return keyList(meta).map(function (k) { return meta.rows[String(k)]; }); }); };
      s.getAllKeys = function () { return settle(t, function () { return keyList(meta); }); };
      s.count = function () { return settle(t, function () { return keyList(meta).length; }); };
      s.delete = function (key) { return settle(t, function () { delete meta.rows[String(key)]; }); };
      s.clear = function () { return settle(t, function () { meta.rows = {}; }); };
      s.createIndex = function (name, keyPath) {
        meta.index[name] = { name: name, keyPath: keyPath, unique: false };
        s.indexNames = Object.keys(meta.index);
        return meta.index[name];
      };
      s.index = function (name) {
        var ix = meta.index[name];
        if (!ix) throw new Error("no index named " + name);
        return {
          name: name,
          getAll: function (value) {
            return settle(t, function () {
              return keyList(meta).filter(function (k) {
                var row = meta.rows[String(k)];
                return row && row[ix.keyPath] === value;
              }).map(function (k) { return meta.rows[String(k)]; });
            });
          },
          get: function (value) { return this.getAll(value); },
          count: function () { return settle(t, function () { return 0; }); },
        };
      };
      s.openCursor = function () { return settle(t, function () { return null; }); };
      s.openKeyCursor = s.openCursor;
      return s;
    }

    function makeDB(name, version) {
      function names() {
        var list = Object.keys(db._stores);
        list.contains = function (n) { return !!db._stores[n]; };
        return list;
      }
      var db = {
        name: name, version: version, onversionchange: null, onclose: null, _stores: {}, _open: 0,
        close: function () {},
        createObjectStore: function (n, opt) {
          opt = opt || {};
          var meta = {
            name: n, keyPath: opt.keyPath === undefined ? null : opt.keyPath,
            auto: !!opt.autoIncrement, index: {}, rows: {}, next: 1
          };
          db._stores[n] = meta;
          db.objectStoreNames = names();
          return makeStore(meta, null);
        },
        deleteObjectStore: function (n) {
          delete db._stores[n];
          db.objectStoreNames = names();
        },
        transaction: function (names, mode) {
          var t = {
            db: db, mode: mode || "readonly", error: null, objectStoreNames: names,
            oncomplete: null, onerror: null, onabort: null, _done: false, _h: {}
          };
          t.addEventListener = function (k, fn) { (t._h[k] = t._h[k] || []).push(fn); };
          t.removeEventListener = function () {};
          t.objectStore = function (n) {
            if (!db._stores[n]) throw new Error("no object store named " + n);
            return makeStore(db._stores[n], t);
          };
          t.abort = function () { t._fire("abort"); };
          t._fire = function (kind) {
            var ev = { type: kind, target: t, currentTarget: t };
            var odd = t["on" + kind];
            if (typeof odd === "function") { try { odd.call(t, ev); } catch (e) {} }
            (t._h[kind] || []).forEach(function (fn) { try { fn.call(t, ev); } catch (e) {} });
          };
          t._settle = function () {
            if (t._done) return;
            t._done = true;
            setTimeout(function () { t._fire("complete"); }, 0);
          };
          t._open = true;
          return t;
        },
      };
      db.objectStoreNames = names();
      return db;
    }

    var factory = {
      open: function (name, version) {
        var r = newRequest();
        var found = DBS[String(name)];
        var old = found ? found.version : 0;
        var wanted = version || old || 1;
        var db = found || makeDB(String(name), wanted);
        DBS[String(name)] = db;
        db.version = wanted;
        r.result = db;
        setTimeout(function () {
          if (wanted > old) r._fire("upgradeneeded", { oldVersion: old, newVersion: wanted });
          r._fire("success");
        }, 0);
        return r;
      },
      deleteDatabase: function (name) {
        var r = newRequest();
        delete DBS[String(name)];
        r.result = undefined;
        setTimeout(function () { r._fire("success"); }, 0);
        return r;
      },
      databases: function () {
        return Promise.resolve(Object.keys(DBS).map(function (n) { return { name: n, version: DBS[n].version }; }));
      },
      cmp: function (a, b) { return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0; },
    };

    try { Object.defineProperty(window, "indexedDB", { value: factory, configurable: true }); } catch (e) {}
    try { Object.defineProperty(window, "IDBKeyRange", { value: undefined, configurable: true }); } catch (e) {}
  }

  /* ---------- the bridge ---------- */
  var seq = 0, waiting = {};
  function ask(url, method, headers, body) {
    return new Promise(function (ok, no) {
      var id = "n" + (++seq);
      waiting[id] = { ok: ok, no: no };
      try {
        parent.postMessage({ nullReq: { id: id, url: url, method: method || "GET", headers: headers || {}, body: body == null ? null : String(body) } }, "*");
      } catch (e) { no(e); }
    });
  }
  addEventListener("message", function (e) {
    var r = e.data && e.data.nullRes;
    if (!r) return;
    var w = waiting[r.id];
    if (!w) return;
    delete waiting[r.id];
    if (r.error) w.no(new Error(r.error));
    else w.ok(r);
  });

  function bytes64(text) {
    var raw = atob(text || ""), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }
  function asText(bytes) {
    if (typeof TextDecoder !== "undefined") { try { return new TextDecoder().decode(bytes); } catch (e) {} }
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return s;
  }
  function headerMap(src) {
    var heads = {};
    if (!src) return heads;
    if (typeof Headers !== "undefined" && src instanceof Headers) src.forEach(function (v, k) { heads[k] = v; });
    else if (Array.isArray(src)) src.forEach(function (p) { heads[p[0]] = p[1]; });
    else Object.keys(src).forEach(function (k) { heads[k] = src[k]; });
    return heads;
  }
  function wire(body, heads) {
    if (body == null) return null;
    if (typeof body === "string") return body;
    if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
      if (!heads["content-type"] && !heads["Content-Type"]) heads["content-type"] = "application/x-www-form-urlencoded;charset=UTF-8";
      return body.toString();
    }
    if (typeof FormData !== "undefined" && body instanceof FormData) {
      if (!heads["content-type"] && !heads["Content-Type"]) heads["content-type"] = "application/x-www-form-urlencoded";
      return new URLSearchParams(body).toString();
    }
    try { return String(body); } catch (e) { return null; }
  }
  function absolute(u) {
    try { return new URL(String(u), document.baseURI).href; } catch (e) { return String(u); }
  }

  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === "string" ? input : (input && input.url) || String(input);
    var heads = headerMap((input && input.headers) || init.headers);
    return ask(absolute(url), (init.method || "GET").toUpperCase(), heads, wire(init.body, heads)).then(function (r) {
      return new Response(bytes64(r.body), {
        status: r.status,
        statusText: r.statusText,
        headers: r.headers || {}
      });
    });
  };

  /* half the libraries on the web still use XHR, and a site whose only
     request fails is a site that draws nothing */
  function BridgeXHR() {
    var self = this;
    var method = "GET", target = "", heads = {}, listeners = {}, aborted = false;
    self.readyState = 0; self.status = 0; self.statusText = ""; self.response = null;
    self.responseText = ""; self.responseType = ""; self.responseURL = ""; self.responseXML = null;
    self.withCredentials = false; self.timeout = 0; self.upload = null;
    self._heads = {};
    function emit(kind) {
      var e = { type: kind, target: self, currentTarget: self };
      var f = self["on" + kind];
      if (typeof f === "function") { try { f.call(self, e); } catch (err) {} }
      (listeners[kind] || []).forEach(function (fn) { try { fn.call(self, e); } catch (err) {} });
    }
    function state(n) { self.readyState = n; emit("readystatechange"); }
    self.open = function (m, u) { method = String(m || "GET").toUpperCase(); target = String(u); state(1); };
    self.setRequestHeader = function (k, v) { heads[k] = v; };
    self.overrideMimeType = function () {};
    self.getAllResponseHeaders = function () {
      var lines = [];
      Object.keys(self._heads).forEach(function (k) { lines.push(k + ": " + self._heads[k]); });
      return lines.join(String.fromCharCode(13, 10));
    };
    self.getResponseHeader = function (k) {
      var v = self._heads[String(k).toLowerCase()];
      return v == null ? null : v;
    };
    self.abort = function () { aborted = true; state(0); emit("abort"); emit("loadend"); };
    self.addEventListener = function (k, fn) { (listeners[k] = listeners[k] || []).push(fn); };
    self.removeEventListener = function (k, fn) {
      listeners[k] = (listeners[k] || []).filter(function (f) { return f !== fn; });
    };
    self.send = function (body) {
      var copy = {}, k;
      for (k in heads) copy[k] = heads[k];
      var sent = wire(body, copy);
      var url = absolute(target);
      state(2);
      ask(url, method, copy, sent).then(function (r) {
        if (aborted) return;
        self.status = r.status;
        self.statusText = r.statusText;
        self.responseURL = r.url || url;
        self._heads = {};
        (r.headers || []).forEach(function (p) { self._heads[String(p[0]).toLowerCase()] = p[1]; });
        var bytes = bytes64(r.body);
        var text = asText(bytes);
        if (self.responseType === "arraybuffer") self.response = bytes.buffer;
        else if (self.responseType === "blob") self.response = new Blob([bytes], { type: self._heads["content-type"] || "" });
        else if (self.responseType === "json") { try { self.response = JSON.parse(text); } catch (e) { self.response = null; } }
        else { self.responseText = text; self.response = text; }
        state(3); state(4); emit("load"); emit("loadend");
      }).catch(function () {
        if (aborted) return;
        self.status = 0;
        state(4); emit("error"); emit("loadend");
      });
    };
  }
  try { window.XMLHttpRequest = BridgeXHR; } catch (e) {}

  /* ---------- the asset bridge ----------
     A <link>, an <img> and a <script src> are fetched by the frame itself,
     not by the page's own code, so the two bridges above never see them. An
     opaque origin makes those requests leave as Origin: null, and a network
     that filters by hostname refuses them before that ever matters — which is
     why a copied page used to arrive as its own inline styles and not much
     else.

     So: any resource that fails to load on its own is pulled over the same
     bridge, and handed back as a blob this copy owns. Lazy on purpose — a
     page whose pictures and sheets load normally pays nothing for this, and a
     filtered one gets its stylesheet, its scripts and its pictures back.

     A stylesheet is fetched as text rather than as bytes, because the images
     and fonts named inside it are relative to the sheet, so each one is
     pulled and swapped in before the text is poured into the page. */
  var grabbed = {};

  function against(u, base) {
    try { return new URL(String(u), base).href; } catch (e) { return String(u); }
  }
  function b64(bytes) {
    var s = "";
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  }
  /* a blob URL first, because it keeps the bytes out of the DOM; a data URL
     for a browser that will not hand one to a frame with no origin */
  function local(got) {
    try { return URL.createObjectURL(new Blob([got.bytes], { type: got.type })); } catch (e) {}
    try { return "data:" + got.type + ";base64," + b64(got.bytes); } catch (e) {}
    return null;
  }
  function pull(url, type) {
    var key = String(url);
    if (!grabbed[key]) {
      grabbed[key] = ask(key, "GET", { accept: type || "*/*" }, null).then(function (r) {
        if (!r) throw new Error("no answer");
        if (r.status && r.status >= 400) throw new Error("HTTP " + r.status);
        var kind = "";
        (r.headers || []).forEach(function (p) {
          if (String(p[0]).toLowerCase() === "content-type") kind = String(p[1]).split(";")[0];
        });
        var blob = local({ bytes: bytes64(r.body), type: kind || type || "application/octet-stream" });
        if (!blob) throw new Error("nothing to hand back");
        return { url: blob };
      });
    }
    return grabbed[key];
  }
  function pour(href, css) {
    var st = document.createElement("style");
    st.setAttribute("data-null-sheet", href);
    st.textContent = css;
    var into = document.head || document.documentElement || document.body;
    if (!into || !into.appendChild) throw new Error("nowhere to put it");
    into.appendChild(st);
  }
  function grabSheet(href) {
    return ask(href, "GET", { accept: "text/css,*/*" }, null).then(function (r) {
      var css = r && r.body ? asText(bytes64(r.body)) : "";
      if (!css.trim()) return false;
      var refs = [], seen = {};
      css.replace(/url\\(\\s*(['\"]?)([^'\")]+)\\1\\s*\\)/gi, function (all, q, raw) {
        var s = String(raw).trim();
        if (/^(data:|blob:|about:|#)/i.test(s) || seen[s]) return all;
        seen[s] = 1;
        refs.push(s);
        return all;
      });
      if (!refs.length) {
        pour(href, css);
        return true;
      }
      return Promise.all(refs.map(function (s) {
        return pull(against(s, href), "").then(function (got) { return got.url; }, function () { return null; });
      })).then(function (urls) {
        var out = css;
        for (var i = 0; i < refs.length; i++) {
          if (urls[i]) out = out.split(refs[i]).join(urls[i]);
        }
        pour(href, out);
        return true;
      });
    }).catch(function () { return false; });
  }

  var WANT = { img: 1, script: 1, link: 1, source: 1, video: 1, audio: 1, track: 1, embed: 1, input: 1, object: 1, image: 1, use: 1, iframe: 1 };
  /* blob URLs need an explicit type on engines that do not infer it from the
     remote response. WASM is especially strict on ChromiumOS. */
  function kindFor(tag, raw) {
    if (/\.wasm($|\\?)/i.test(raw)) return "application/wasm,*/*";
    if (tag === "script") return "text/javascript,*/*";
    if (tag === "img" || tag === "image") return "image/*,*/*";
    if (tag === "video") return "video/*,*/*";
    if (tag === "audio") return "audio/*,*/*";
    if (tag === "link" || /\\.css($|\\?)/i.test(raw)) return "text/css,*/*";
    return "*/*";
  }
  function rescue(el) {
    var tag = el && el.tagName ? String(el.tagName).toLowerCase() : "";
    if (!WANT[tag] || !el.getAttribute || el.getAttribute("data-null-pulled")) return;
    var attr = tag === "object" ? "data" : tag === "link" || tag === "image" || tag === "use" ? "href" : "src";
    var raw = el.getAttribute(attr);
    if (!raw || /^(data:|blob:|about:|javascript:)/i.test(raw)) return;
    var here = document.baseURI;
    el.setAttribute("data-null-pulled", "1");

    if (tag === "link" && String(el.getAttribute("rel") || "").toLowerCase().indexOf("stylesheet") >= 0) {
      grabSheet(against(raw, here));
      return;
    }
    pull(against(raw, here), kindFor(tag, raw)).then(function (got) {
      /* a srcset would win over the src that was just fixed, and every
         candidate in it failed the same way */
      if (tag === "img" && el.removeAttribute) el.removeAttribute("srcset");
      el.setAttribute(attr, got.url);
    }, function () {});
  }

  /* resource errors do not bubble, but they do reach a capturing listener on
     the window — one hook, and it is the one every kind of asset shares */
  addEventListener("error", function (e) {
    var el = e && (e.target || e.srcElement);
    if (el && el.tagName) rescue(el);
  }, true);

  /* ---------- telling the window above what happened ----------
     A page that threw while it mounted unmounts itself and leaves a black
     pane with no explanation anywhere. These two hand the first reason up, so
     the alert in the window can say it out loud. */
  var told = false;
  function report(msg) {
    if (told) return;
    told = true;
    try { parent.postMessage({ nullErr: String(msg).slice(0, 300) }, "*"); } catch (e) {}
  }
  addEventListener("error", function (e) {
    if (e && e.message) report(e.message);
  });
  addEventListener("unhandledrejection", function (e) {
    var why = e && e.reason;
    report((why && (why.message || why)) || "a promise was rejected");
  });

  /* what this copy can actually see, so the window above can tell a page that
     drew from one that came through as an empty shell */
  setTimeout(function () {
    var chars = 0;
    try { chars = ((document.body && document.body.innerText) || "").trim().length; } catch (e) {}
    try { parent.postMessage({ nullSay: { chars: chars } }, "*"); } catch (e) {}
  }, 4000);

  document.addEventListener("click", function(e){
    var a = e.target && e.target.closest ? e.target.closest("a") : null;
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (!href || href.charAt(0) === "#") return;
    e.preventDefault();
    out(a.href);
  }, true);
  document.addEventListener("submit", function(e){
    var f = e.target;
    if (!f || !f.action) return;
    e.preventDefault();
    var q = "";
    try { q = new URLSearchParams(new FormData(f)).toString(); } catch (err) {}
    out(f.action + ((f.method || "get").toLowerCase() === "get" && q ? "?" + q : ""));
  }, true);
  try {
    var b = document.createElement("base");
    b.target = "_self";
    document.head && document.head.prepend(b);
  } catch (e) {}
})()</script>`;

export function prepare(html: string, url: string): string {
  let out = html
    .replace(/<meta[^>]+http-equiv\s*=\s*["']?content-security-policy["']?[^>]*>/gi, "")
    .replace(/\sintegrity\s*=\s*("[^"]*"|'[^']*')/gi, "");

  const base = `<base href="${url.replace(/"/g, "&quot;")}">`;
  if (/<head[^>]*>/i.test(out)) out = out.replace(/<head[^>]*>/i, (m) => m + base + NAV);
  else out = base + NAV + out;

  return out;
}
