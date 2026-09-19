/* NULL · rungame.ts
   Read a stashed game and run it here, in this document, with no frame.

   A frame is the honest way to run a stranger's page: it gets its own
   document, its own globals and no way into ours. But a browser, a parent
   frame or a site's own headers can all decide a frame will not be shown — and
   a frame that is refused reads to a player as "this page is blocked". So
   there is a second road, and it is this file.

   Four things have to be true for a copied page to run, and each one is a step
   below:

   · its markup has to go somewhere scripts can run — a shadow root, so the
     site's CSS cannot reach in and the game's CSS cannot leak out;
   · its pictures, styles and scripts have to point back at the stash rather
     than at NULL, so every URL in the copy is made absolute;
   · its scripts have to be *created* rather than parsed, because markup
     inserted as HTML runs none of them: each one is rebuilt in the order it
     was written, with `async = false` so that order holds;
   · its relative requests at runtime — a level file, a sprite sheet — resolve
     against the document, so the caller puts a <base> in for as long as the
     game is on screen. See useStashBase() in the player. */

/** Read a page, by whichever road will answer.
 *
 *  This document's own fetch first: it is the fastest by far, and the stashes
 *  that run the library send the one header that makes it legal. When that
 *  fails — no CORS header on the host, or a stash that does not like where the
 *  request came from — the site's own relay is asked instead. That is the
 *  reader the proxy window already uses: it makes the request somewhere else
 *  and hands the page back, which is the only way to read a page whose host
 *  decides who may ask. */
export async function readPage(url: string): Promise<string> {
  try {
    return await grab(url);
  } catch (direct) {
    const { read } = await import("./relay");
    const { prefs } = await import("./themes");
    const got = await read(url, prefs.get().relay);
    if (got.ok) return got.html;
    throw new Error(`${(direct as Error).message}; through the relay, ${got.reason}`);
  }
}

/** A stashed page, with one retry. Raw GitHub answers 429 when a page asks it
 *  for a dozen files at once, and a game that needs clicking twice is a game
 *  that looks broken the first time. */
export async function grab(url: string): Promise<string> {
  for (let go = 0; ; go++) {
    const res = await fetch(url, { credentials: "omit" });
    if (res.ok) return res.text();
    if (go === 0 && (res.status === 429 || res.status >= 500)) {
      await new Promise((r) => setTimeout(r, 700));
      continue;
    }
    throw new Error(`it answered ${res.status}`);
  }
}

/** Our own floor under the page: a full-bleed stage, and nothing else that the
 *  game's own stylesheet cannot overrule. */
const FLOOR = `
  :host { display: block; position: absolute; inset: 0; }
  .null-root, .null-root * { box-sizing: border-box; }
  .null-root {
    position: absolute; inset: 0; overflow: hidden;
    color-scheme: dark; background: #000;
    font-family: system-ui, sans-serif; font-size: 14px;
  }
  .null-root canvas { display: block; }
  .null-root img { max-width: 100%; }
`;

/** A page's own CSS talks to `html`, `body` and `:root`, none of which exist
 *  inside a shadow root. They are pointed at the wrapper that stands in for
 *  them, so a game whose stylesheet says `body { background: black }` gets a
 *  black background instead of a white box. */
export function retarget(css: string): string {
  return css.replace(/(^|[},])(\s*)(html|body|:root)\b/gim, "$1$2.null-root");
}

/** Every address in the copy, resolved against the page it came from. */
export function absolutize(scope: ParentNode, base: string) {
  const one = (raw: string | null) => {
    if (!raw || /^(data:|blob:|javascript:|mailto:|tel:|#)/i.test(raw.trim())) return null;
    try {
      return new URL(raw, base).href;
    } catch {
      return null;
    }
  };
  scope.querySelectorAll<HTMLElement>("[src], [href], [poster], [data], [action]").forEach((el) => {
    for (const attr of ["src", "href", "poster", "data", "action"]) {
      const fixed = one(el.getAttribute(attr));
      if (fixed) el.setAttribute(attr, fixed);
    }
  });
  scope.querySelectorAll<HTMLElement>("[srcset]").forEach((el) => {
    const fixed = (el.getAttribute("srcset") ?? "")
      .split(",")
      .map((part) => {
        const [url, size] = part.trim().split(/\s+/);
        const abs = one(url);
        return abs ? `${abs}${size ? ` ${size}` : ""}` : null;
      })
      .filter(Boolean)
      .join(", ");
    if (fixed) el.setAttribute("srcset", fixed);
  });
}

/** Where a copied page's relative URLs should point.
 *
 *  A page that names a base of its own keeps it: several stashes point theirs
 *  at a CDN that really does hold their files, and that CDN is right.
 *  Otherwise it is the folder the page came from. */
export function baseOf(html: string, file: string): string {
  const own = /<base[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  return new URL(own || file.slice(0, file.lastIndexOf("/") + 1), file).href;
}

/** Put a page's markup, styles and scripts into `host`'s shadow root.
 *
 *  Returns the base the copy resolves against, so the caller can point the
 *  document at it for as long as the game is on screen. */
export function mountInline(host: HTMLElement, html: string, file: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const base = baseOf(html, file);
  doc.querySelectorAll("base").forEach((b) => b.remove());

  /* scripts are lifted out first: their order across head and body is the
     order they have to run in, and markup inserted as HTML would drop them */
  const scripts = [...doc.querySelectorAll("script")].map((s) => ({
    src: s.getAttribute("src"),
    type: s.getAttribute("type"),
    text: s.textContent ?? "",
  }));
  doc.querySelectorAll("script").forEach((s) => s.remove());

  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  shadow.textContent = "";

  const floor = document.createElement("style");
  floor.textContent = FLOOR;
  shadow.append(floor);

  /* the wrapper stands in for <html> and <body>, which a shadow root does not
     have — their classes and inline styles come with it */
  const wrap = document.createElement("div");
  wrap.className = "null-root";
  const htmlEl = doc.documentElement;
  const bodyEl = doc.body;
  if (htmlEl.getAttribute("class")) wrap.classList.add(...htmlEl.className.split(/\s+/).filter(Boolean));
  if (htmlEl.getAttribute("style")) wrap.setAttribute("style", htmlEl.getAttribute("style") ?? "");
  for (const child of [...doc.head.children, ...bodyEl.children]) wrap.append(child);
  if (bodyEl.getAttribute("class")) wrap.classList.add(...bodyEl.className.split(/\s+/).filter(Boolean));
  if (bodyEl.getAttribute("style")) {
    wrap.setAttribute("style", `${wrap.getAttribute("style") ?? ""} ${bodyEl.getAttribute("style")}`);
  }

  absolutize(wrap, base);
  shadow.append(wrap);

  /* the page's inline styles, retargeted now that they are in the tree */
  wrap.querySelectorAll("style").forEach((s) => {
    if (s.textContent) s.textContent = retarget(s.textContent);
  });

  /* links out of a game open a tab; they never navigate NULL away from itself */
  shadow.addEventListener("click", (e) => {
    const a = (e.target as HTMLElement)?.closest?.("a");
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute("href");
    if (href && !href.startsWith("#")) window.open(href, "_blank", "noreferrer");
  });

  for (const s of scripts) {
    const el = document.createElement("script");
    if (s.type) el.type = s.type;
    if (s.src) {
      /* a src that does not resolve is dropped rather than left to throw —
         "Uncaught ReferenceError: EngineLoader is not defined" is what an
         engine page looks like when its own files went missing */
      let href = "";
      try {
        href = new URL(s.src, base).href;
      } catch {
        continue;
      }
      el.src = href;
      el.async = false; // inserted scripts are async by default, which reorders them
    } else {
      /* one line of a page's own boot code throwing must not read as NULL
         being broken. The wrap is what turns a stranger's ReferenceError
         into console noise instead of an uncaught error attributed to this
         document — and `void 0` keeps a bare `return` inside the guard legal. */
      el.textContent = `try{${s.text}}catch(__e){console.warn("[null] game script:",__e&&__e.message)};void 0;`;
    }
    shadow.append(el);
  }

  return base;
}

/** A blob has no directory, so `scripts/game.js` inside a copied page has
 *  nowhere to resolve to. Pointing the page back at the folder it came from
 *  fixes every relative asset it asks for; the ones that are not in the stash
 *  are missing either way, which is the stash's business, not ours.
 *
 *  A page that names a base of its own is left completely alone, for the same
 *  reason baseOf honours it: the first base wins. */
export function rebased(html: string, file: string): string {
  if (/<base\s/i.test(html)) return html;
  const dir = file.slice(0, file.lastIndexOf("/") + 1);
  const base = `<base href="${dir}">`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + base);
  return base + html;
}

/** Hosts that serve a page as text rather than as html, so a frame handed
 *  their URL renders the page's own source code. raw GitHub is the one the
 *  library runs into: it labels every file text/plain with nosniff. */
export const AS_TEXT = /raw\.githubusercontent\.com|gist\.githubusercontent\.com/;

/* ---------- the storage shim ----------
   The copy road sandboxes the game's frame, and a sandboxed frame is an
   opaque origin: `localStorage` throws the moment it is *touched*, and
   `indexedDB.open` throws the moment it is called. Half the games on the
   shelf read a save key on their first line — which made them throw before
   they drew, and left the player staring at a black or white page.

   So the copy is handed a stand-in: an in-memory store that answers the
   whole Web Storage surface (item events included, which save screens
   listen for), and a small Indexed Database for the games that ask for one.
   Memory instead of disk — progress lasts as long as the page does, which
   is the trade for a page that draws at all.

   One string, no interpolation, and nothing inside it may use a backtick —
   the same rule the relay's own shim lives by. */
const SHIM = `(function(){
  var mem = {};
  function shelf() {
    return {
      getItem: function (k) { k = String(k); return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[String(k)] = String(v); },
      removeItem: function (k) { delete mem[String(k)]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; }
    };
  }
  function fits(store) {
    try { store.setItem("__null__", "1"); store.removeItem("__null__"); return true; } catch (e) { return false; }
  }
  if (!fits(window.localStorage)) {
    try { Object.defineProperty(window, "localStorage", { value: shelf(), configurable: true }); } catch (e) {}
  }
  if (!fits(window.sessionStorage)) {
    try { Object.defineProperty(window, "sessionStorage", { value: shelf(), configurable: true }); } catch (e) {}
  }

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
    function fresh() {
      var r = {
        result: undefined, error: null, readyState: "pending", source: null, transaction: null,
        onsuccess: null, onerror: null, onupgradeneeded: null, _h: {}
      };
      r.addEventListener = function (k, fn) { (r._h[k] = r._h[k] || []).push(fn); };
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
    function order(meta) {
      return Object.keys(meta.rows).map(function (k) {
        return (String(Number(k)) === k && k !== "") ? Number(k) : k;
      }).sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    }
    function run(t, work) {
      var r = fresh();
      setTimeout(function () {
        try { r.result = work(); r._fire("success"); }
        catch (e) { r.error = e; r._fire("error"); }
      }, 0);
      return r;
    }
    function store(meta) {
      var s = {
        name: meta.name, keyPath: meta.keyPath, autoIncrement: meta.auto,
        indexNames: Object.keys(meta.index)
      };
      s.put = function (v, given) {
        return run(null, function () {
          var k = given !== undefined && given !== null ? given : (meta.keyPath && v != null ? v[meta.keyPath] : undefined);
          if (k === undefined || k === null) { if (!meta.auto) throw new Error("no key"); k = meta.next++; }
          meta.rows[String(k)] = v; return k;
        });
      };
      s.add = s.put;
      s.get = function (k) { return run(null, function () { return meta.rows[String(k)]; }); };
      s.getAll = function () { return run(null, function () { return order(meta).map(function (k) { return meta.rows[String(k)]; }); }); };
      s.getAllKeys = function () { return run(null, function () { return order(meta); }); };
      s.count = function () { return run(null, function () { return order(meta).length; }); };
      s.delete = function (k) { return run(null, function () { delete meta.rows[String(k)]; }); };
      s.clear = function () { return run(null, function () { meta.rows = {}; }); };
      s.createIndex = function (n, kp) { meta.index[n] = { name: n, keyPath: kp }; s.indexNames = Object.keys(meta.index); return meta.index[n]; };
      s.index = function (n) {
        var ix = meta.index[n];
        if (!ix) throw new Error("no index named " + n);
        return {
          name: n,
          getAll: function (v) { return run(null, function () { return order(meta).filter(function (k) { var row = meta.rows[String(k)]; return row && row[ix.keyPath] === v; }).map(function (k) { return meta.rows[String(k)]; }); }); },
          get: function (v) { return this.getAll(v); },
          count: function () { return run(null, function () { return 0; }); }
        };
      };
      s.openCursor = function () { return run(null, function () { return null; }); };
      s.openKeyCursor = s.openCursor;
      return s;
    }
    var factory = {
      open: function (name, version) {
        var r = fresh();
        var found = DBS[String(name)];
        var old = found ? found.version : 0;
        var wanted = version || old || 1;
        var db = found || {
          name: String(name), version: wanted, _stores: {}, onversionchange: null,
          close: function () {},
          createObjectStore: function (n, opt) {
            opt = opt || {};
            var meta = { name: n, keyPath: opt.keyPath === undefined ? null : opt.keyPath, auto: !!opt.autoIncrement, index: {}, rows: {}, next: 1 };
            db._stores[n] = meta;
            db.objectStoreNames = Object.keys(db._stores);
            return store(meta);
          },
          deleteObjectStore: function (n) { delete db._stores[n]; db.objectStoreNames = Object.keys(db._stores); },
          transaction: function (names) {
            var t = { db: db, mode: "readonly", objectStoreNames: [].concat(names), oncomplete: null, onerror: null, onabort: null, _h: {} };
            t.addEventListener = function (k, fn) { (t._h[k] = t._h[k] || []).push(fn); };
            t.objectStore = function (n) {
              if (!db._stores[n]) throw new Error("no object store named " + n);
              return store(db._stores[n]);
            };
            t.abort = function () {};
            setTimeout(function () { t._fire2 = 1; (t._h["complete"] || []).forEach(function (fn) { try { fn.call(t, { type: "complete" }); } catch (e) {} }); if (typeof t.oncomplete === "function") try { t.oncomplete({ type: "complete" }); } catch (e) {} }, 0);
            return t;
          }
        };
        db._fire2 = 0;
        db.objectStoreNames = Object.keys(db._stores);
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
        var r = fresh();
        delete DBS[String(name)];
        r.result = undefined;
        setTimeout(function () { r._fire("success"); }, 0);
        return r;
      },
      databases: function () {
        return Promise.resolve(Object.keys(DBS).map(function (n) { return { name: n, version: DBS[n].version }; }));
      },
      cmp: function (a, b) { return a < b ? -1 : a > b ? 1 : 0; }
    };
    try { Object.defineProperty(window, "indexedDB", { value: factory, configurable: true }); } catch (e) {}
  }
})()`;

/** The shim goes in ahead of everything: it is what makes a sandboxed copy
 *  of a game draw instead of throwing on its first line. */
export function withShim(html: string): string {
  const tag = `<script data-null="storage">${SHIM}</script>`;
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + tag);
  return tag + html;
}
