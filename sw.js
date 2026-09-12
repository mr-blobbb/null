/* NULL — sw.js
   Root service worker: makes NULL installable (Chrome "Install app") and
   keeps the shell usable offline.

   Strategy:
     · navigations  — network first, so updates always land; cached page on
                      failure, falling back to the cached home shell.
     · same-origin  — network first too (a static host serves the raw files;
       GET assets     a cached copy is only ever a fallback), filling the
                      runtime cache on success.

   Cache writes are type-checked: a stylesheet URL may only be stored when the
   response really is text/css. Without that guard a dev server's JS-wrapped
   CSS gets cached and then served to <link> tags, which browsers reject —
   leaving every page unstyled.

   Bump CACHE/RUNTIME when the core file list changes so old caches are dropped. */
const CACHE = "null-v6";
const RUNTIME = "null-runtime-v6";

const CORE = [
  "/",
  "/index.html",
  "/404.html",
  "/player.html",
  "/schedule.html",
  "/settings.html",
  "/announcements.html",
  "/shop.html",
  "/backups.html",
  "/games/",
  "/apps/",
  "/proxies/",
  "/public/favicon.svg",
  "/public/manifest.webmanifest",
  "/public/icon-192.png",
  "/public/icon-512.png",
  "/src/styles/global.css",
  "/src/styles/extra.css",
  "/src/styles/particles.css",
  "/src/styles/perf.css",
  "/src/utilities/store.js",
  "/src/utilities/dom.js",
  "/src/utilities/modal.js",
  "/src/utilities/theme.js",
  "/src/utilities/econ.js",
  "/src/components/seasons.js",
  "/src/utilities/scroll.js",
  "/src/routing/router.js",
  "/src/catalog/catalog.js",
  "/src/content/content.js",
  "/src/components/tabpresets.js",
  "/src/components/schedule.js",
  "/src/components/cards.js",
  "/src/components/search.js",
  "/src/components/daily.js",
  "/src/components/shell.js",
  "/src/components/devconsole.js",
  "/src/pages/home.js",
  "/src/pages/library.js",
  "/src/pages/player.js",
  "/src/pages/settings.js",
  "/src/pages/announcements.js",
  "/src/pages/schedule.js",
  "/src/pages/shop.js",
];

/* ---------- cache hygiene ----------
   Only store a response under a URL when its type matches what that URL is
   supposed to be. Keeps transformed (JS-as-CSS) dev responses out of the
   cache. Shared by the precache and the runtime fetch handler. */
function typeOk(path, res) {
  const ct = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (/\.css$/i.test(path)) return ct === "text/css";
  if (/\.m?js$/i.test(path)) return ct === "text/javascript" || ct === "application/javascript";
  if (/\.webmanifest$/i.test(path)) return ct === "application/manifest+json" || ct === "application/json";
  return true;
}

function storable(path, res) {
  if (!res || !res.ok || res.type === "opaque" || res.status !== 200) return false;
  return typeOk(path, res);
}

function keep(cache, url, res) {
  try {
    if (storable(new URL(url, self.location.origin).pathname, res)) cache.put(url, res.clone());
  } catch (err) {
    /* a failed cache write should never break the page */
  }
}

/* Precache one URL at a time so a single bad response can't abort the rest,
   and so the type guard applies (addAll() would store whatever came back). */
function precache() {
  return caches.open(CACHE).then((cache) =>
    Promise.all(
      CORE.map((url) =>
        fetch(url, { cache: "reload" })
          .then((res) => keep(cache, url, res))
          .catch(() => {}),
      ),
    ),
  );
}

self.addEventListener("install", (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE && k !== RUNTIME)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isAsset(req) {
  return req.method === "GET" && new URL(req.url).origin === self.location.origin;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (!isAsset(req)) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match("/"))
            .then((hit) => hit || Response.error()),
        ),
    );
    return;
  }

  /* network first — fresh, correctly-typed files always win; the cache is
     only a fallback for offline use */
  e.respondWith(
    fetch(req)
      .then((res) => {
        if (storable(new URL(req.url).pathname, res)) {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() =>
        caches
          .match(req)
          .then((hit) => hit || fetch(req))
          .catch(() => Response.error()),
      ),
  );
});
