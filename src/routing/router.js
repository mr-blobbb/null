/* NULL · router.js
   Single source of truth for the navigation model: which links exist, where
   they point, and which one is active on the current page. Pages are plain
   HTML files: this just keeps their menus/footers consistent.

   Root pages are linked by their extensionless site path ("/schedule"), which
   is what a visitor sees in the address bar. GitHub Pages serves those through
   404.html (it redirects to the real file) and the service worker answers for
   them offline; /games/ style folder links hit the directory index directly. */
(function () {
  var N = (window.N = window.N || {});

  /* Every destination once, by key. The rail, the More panel and the drawer
     are all built from this table, so a new page is one line here and it turns
     up in all three. */
  var LINKS = {
    games: { id: "games", t: "Games", url: "/games/", icon: "game" },
    apps: { id: "apps", t: "Apps", url: "/apps/", icon: "grid" },
    proxies: { id: "proxies", t: "Proxies", url: "/proxies/", icon: "proxy" },
    announcements: { id: "announcements", t: "Announcements", url: "/announcements", icon: "ann" },
    schedule: { id: "schedule", t: "Schedule", url: "/schedule", icon: "sched" },
    shop: { id: "shop", t: "Shop", url: "/shop", icon: "store" },
    extensions: { id: "extensions", t: "Extensions", url: "/extensions", icon: "puzzle" },
    labs: { id: "labs", t: "Labs", url: "/labs", icon: "beaker" },
    backups: { id: "backups", t: "Backups", url: "/backups", icon: "backups" },
    settings: { id: "settings", t: "Settings", url: "/settings", icon: "settings" },
    about: { id: "about", t: "About", url: "/about", icon: "info" },
    district: { id: "district", t: "District", url: "/district", icon: "school" },
    license: { id: "license", t: "License", url: "/license", icon: "scale" },
    privacy: { id: "privacy", t: "Privacy", url: "/privacy", icon: "lock" },
    terms: { id: "terms", t: "Terms", url: "/terms", icon: "file" },
    cookies: { id: "cookies", t: "Cookies", url: "/cookies", icon: "cookie" },
  };

  /* The rail: four doors and nothing else, so they can sit far apart and the
     row is never a wall of icons. Home is the NULL brand mark. */
  var PRIMARY = [
    LINKS.games,
    LINKS.apps,
    LINKS.announcements,
    LINKS.settings,
  ];

  /* Everything else, grouped for the More panel and for the mobile drawer.
     The Extensions page is added to that panel by shell.js, because the
     installed popups are listed under the same heading. */
  var MORE = [
    {
      name: "Browse",
      links: [LINKS.proxies, LINKS.schedule, LINKS.shop, LINKS.labs, LINKS.backups],
    },
    {
      name: "Info",
      links: [LINKS.about, LINKS.district, LINKS.license, LINKS.privacy, LINKS.terms, LINKS.cookies],
    },
  ];

  /* grouped view used by the mobile drawer, which has room for the lot */
  var GROUPS = [
    { name: "Library", links: [LINKS.games, LINKS.apps, LINKS.proxies] },
    {
      name: "Site",
      links: [
        LINKS.announcements,
        LINKS.schedule,
        LINKS.shop,
        LINKS.extensions,
        LINKS.labs,
        LINKS.backups,
        LINKS.settings,
      ],
    },
    { name: "Info", links: MORE[1].links },
  ];

  /* About / District / License / Privacy / Terms / Cookies are also in the
     footer bottom links: they stay one click away from any page. */
  var FOOT = [
    {
      name: "Explore",
      links: [
        { t: "Home", url: "/" },
        { t: "Games", url: "/games/" },
        { t: "Apps", url: "/apps/" },
        { t: "Proxies", url: "/proxies/" },
        { t: "Announcements", url: "/announcements" },
        { t: "Schedule", url: "/schedule" },
        { t: "Shop", url: "/shop" },
        { t: "Settings", url: "/settings" },
      ],
    },
    {
      name: "Info",
      links: [
        { t: "About", url: "/about" },
        { t: "District", url: "/district" },
        { t: "License", url: "/license" },
        { t: "Privacy", url: "/privacy" },
        { t: "Terms", url: "/terms" },
        { t: "Cookies", url: "/cookies" },
      ],
    },
  ];

  function isActive(url) {
    /* compare the page against the link *inside* NULL: strip the folder NULL
       is served from first, so the same table lights up the right item at a
       domain root and under a project path alike */
    var p = location.pathname;
    if (N.base !== "/" && p.indexOf(N.base) === 0) p = "/" + p.slice(N.base.length);
    if (url === "/") return p === "/" || p === "/index.html";
    /* normalize both sides: strip the trailing slash, any /index.html
       suffix and any .html, so /games, /games/, /games/index.html and
       /games.html all light up the same nav item on any host */
    function norm(s) {
      if (s.length > 1 && s.charAt(s.length - 1) === "/") s = s.slice(0, -1);
      if (s.slice(-11) === "/index.html") s = s.slice(0, -11);
      return s.replace(/\.html$/, "");
    }
    var dir = norm(p);
    var target = norm(url);
    return dir === target || dir === target + ".html";
  }

  /* is any page in the More panel the one on screen? the More button lights
     up off this, so a visitor on /proxies can still see where they are. */
  function inMore(url) {
    return MORE.some(function (g) {
      return g.links.some(function (l) {
        return isActive(l.url);
      });
    });
  }

  N.router = {
    LINKS: LINKS,
    PRIMARY: PRIMARY,
    MORE: MORE,
    GROUPS: GROUPS,
    FOOT: FOOT,
    isActive: isActive,
    inMore: inMore,
    all: function () {
      return PRIMARY.concat(
        MORE.reduce(function (a, g) {
          return a.concat(g.links);
        }, []),
      );
    },
  };
})();
