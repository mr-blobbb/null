/* NULL — sw.js
   Root service worker: makes NULL installable (Chrome "Install app") and
   keeps the shell usable offline.

   Strategy:
     · navigations  — network first, so updates always land; cached page on
                      failure, falling back to the cached home shell.
     · same-origin  — cache first (games/css/js are static), filling the
       GET assets     runtime cache on first fetch; network fallback, then
                      cache, when offline.

   Bump CACHE when the core file list changes so old caches are dropped. */
const CACHE = "null-v1";
const RUNTIME = "null-runtime-v1";

const CORE = [
  "/",
  "/index.html",
  "/404.html",
  "/player.html",
  "/schedule",
  "/settings",
  "/announcements",
  "/shop",
  "/backups",
  "/games/",
  "/apps/",
  "/proxies/",
  "/public/favicon.svg",
  "/public/manifest.webmanifest",
  "/public/icon-192.png",
  "/public/icon-512.png",
  "/src/styles/global.css",
  "/src/styles/extra.css",
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

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(CORE))
      .then(() => self.skipWaiting())
      .catch(() => {}),
  );
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

  if (!isAsset(req)) return;

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const copy = res.clone();
              caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
            }
            return res;
          })
          .catch(() => caches.match(req).then((c) => c || Response.error())),
    ),
  );
});
